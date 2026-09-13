"""Continuous triangle-surface collision intervals for one rigid translation.

No time sampling is used. Triangle orientations are fixed, so each separating
axis supplies a linear interval of possible intersection times. Intersecting
those intervals gives the complete contact interval on t in [0, 1]. Coplanar
triangles include in-plane edge normals; degenerate segments/points also have
the required axes. A pair of median-split AABB trees bounds candidate work.

This is a SURFACE test. A closed object wholly contained in another closed
solid can have no surface intersections; callers must separately test solid
containment. Initial contacts are returned, never silently forgiven.
"""
from dataclasses import dataclass

import numpy as np


@dataclass(slots=True)
class _Node:
    lo: np.ndarray
    hi: np.ndarray
    count: int
    indices: object = None
    left: object = None
    right: object = None


def _tree(lo, hi, leaf_size=16):
    centers = (lo + hi) * .5

    def build(indices):
        node = _Node(lo[indices].min(0), hi[indices].max(0), len(indices))
        if len(indices) <= leaf_size:
            node.indices = indices
            return node
        axis = int(np.argmax(np.ptp(centers[indices], axis=0)))
        middle = len(indices) // 2
        order = np.argpartition(centers[indices, axis], middle)
        node.left = build(indices[order[:middle]])
        node.right = build(indices[order[middle:]])
        return node

    return build(np.arange(len(lo), dtype=np.int64))


def _candidate_batches(a_lo, a_hi, b_lo, b_hi, tolerance, stats, batch_size=2048):
    a_root, b_root = _tree(a_lo, a_hi), _tree(b_lo, b_hi)
    stack = [(a_root, b_root)]
    queued_a, queued_b, queued_count = [], [], 0
    while stack:
        a, b = stack.pop()
        stats['aabbNodePairTests'] += 1
        if np.any(a.lo > b.hi + tolerance) or np.any(b.lo > a.hi + tolerance):
            continue
        if a.indices is not None and b.indices is not None:
            ai, bi = a.indices, b.indices
            overlap = (a_lo[ai, None, :] <= b_hi[None, bi, :] + tolerance).all(2)
            overlap &= (b_lo[None, bi, :] <= a_hi[ai, None, :] + tolerance).all(2)
            ia, ib = np.nonzero(overlap)
            if len(ia):
                queued_a.append(ai[ia])
                queued_b.append(bi[ib])
                queued_count += len(ia)
            if queued_count >= batch_size:
                yield np.concatenate(queued_a), np.concatenate(queued_b)
                queued_a, queued_b, queued_count = [], [], 0
        elif b.indices is not None or (a.indices is None and a.count >= b.count):
            stack.extend(((a.left, b), (a.right, b)))
        else:
            stack.extend(((a, b.left), (a, b.right)))
    if queued_count:
        yield np.concatenate(queued_a), np.concatenate(queued_b)


def _axes(a, b):
    edge_a = np.roll(a, -1, axis=1) - a
    edge_b = np.roll(b, -1, axis=1) - b
    normal_a = np.cross(edge_a[:, 0], edge_a[:, 1])
    normal_b = np.cross(edge_b[:, 0], edge_b[:, 1])
    edge_crosses = np.cross(edge_a[:, :, None, :], edge_b[:, None, :, :]).reshape(-1, 9, 3)
    axes = np.concatenate((normal_a[:, None, :], normal_b[:, None, :], edge_crosses,
                           np.cross(normal_a[:, None, :], edge_a),
                           np.cross(normal_b[:, None, :], edge_b)), axis=1)
    # The common nondegenerate case needs 17 axes. Point/segment triangles
    # require additional axes because their own face normals vanish.
    degenerate = (np.linalg.norm(normal_a, axis=1) < 1e-24) | (np.linalg.norm(normal_b, axis=1) < 1e-24)
    if degenerate.any():
        row = np.arange(len(a))
        direction_a = edge_a[row, np.argmax(np.linalg.norm(edge_a, axis=2), axis=1)]
        direction_b = edge_b[row, np.argmax(np.linalg.norm(edge_b, axis=2), axis=1)]
        joint_normal = np.cross(direction_a, direction_b)
        world_axes = np.broadcast_to(np.eye(3), (len(a), 3, 3))
        extra = np.concatenate((world_axes, direction_a[:, None, :], direction_b[:, None, :],
                                np.cross(direction_a[:, None, :], world_axes),
                                np.cross(direction_b[:, None, :], world_axes),
                                np.cross(joint_normal, direction_a)[:, None, :],
                                np.cross(joint_normal, direction_b)[:, None, :]), axis=1)
        extra[~degenerate] = 0
        axes = np.concatenate((axes, extra), axis=1)
    lengths = np.linalg.norm(axes, axis=2)
    return np.divide(axes, lengths[:, :, None], out=np.zeros_like(axes),
                     where=lengths[:, :, None] > 1e-30)


def _intervals(a, b, delta, tolerance):
    # A local origin reduces cancellation in large world-coordinate scenes.
    origin = a[:, :1, :].copy()
    a, b = a - origin, b - origin
    axes = _axes(a, b)
    projection_a = np.einsum('nvc,nkc->nkv', a, axes)
    projection_b = np.einsum('nvc,nkc->nkv', b, axes)
    low = projection_b.min(2) - projection_a.max(2) - tolerance
    high = projection_b.max(2) - projection_a.min(2) + tolerance
    speed = np.einsum('c,nkc->nk', delta, axes)
    stationary = np.abs(speed) <= 1e-15
    separated_static = stationary & ((low > 0) | (high < 0))
    first = np.divide(low, speed, out=np.full_like(speed, -np.inf), where=~stationary)
    second = np.divide(high, speed, out=np.full_like(speed, np.inf), where=~stationary)
    enter_axis, exit_axis = np.minimum(first, second), np.maximum(first, second)
    enter = np.maximum(0.0, enter_axis.max(1))
    leave = np.minimum(1.0, exit_axis.min(1))
    intersects = ~separated_static.any(1) & (enter <= leave)
    return intersects, enter, leave


def _mesh(vertices, faces, name):
    vertices = np.asarray(vertices, dtype=np.float64)
    faces = np.asarray(faces, dtype=np.int64)
    if vertices.size == 0:
        vertices = vertices.reshape(0, 3)
    if faces.size == 0:
        faces = faces.reshape(0, 3)
    if vertices.ndim != 2 or vertices.shape[1] != 3 or not np.isfinite(vertices).all():
        raise ValueError(name + ' vertices must be a finite N x 3 array')
    if faces.ndim != 2 or faces.shape[1] != 3:
        raise ValueError(name + ' faces must be triangulated M x 3 indices')
    if faces.size and (faces.min() < 0 or faces.max() >= len(vertices)):
        raise ValueError(name + ' face index is outside the vertex array')
    return vertices[faces]


def check_translation(moving_vertices, moving_faces, other_vertices, other_faces,
                      delta, *, tolerance=1e-8):
    """Return every intersecting triangle pair and its closed [tEnter,tExit].

    ``delta`` is the moving mesh's full world-space translation; the other mesh
    stays at its supplied world-space coordinates. ``tolerance`` is the spatial
    expansion of each SAT overlap interval, in the same coordinate units. Use
    zero for unexpanded floating-point intervals. IDs index the supplied face
    arrays. Results include zero-duration touches and all contacts at t=0.

    A successful return with an empty ``collisions`` list establishes only that
    no triangle SURFACES touch on the translation; it does not certify absence
    of solid containment. The report states this limit explicitly.
    """
    tolerance = float(tolerance)
    delta = np.asarray(delta, dtype=np.float64)
    if delta.shape != (3,) or not np.isfinite(delta).all():
        raise ValueError('delta must be a finite three-vector')
    if not np.isfinite(tolerance) or tolerance < 0:
        raise ValueError('tolerance must be finite and nonnegative')
    a = _mesh(moving_vertices, moving_faces, 'Moving')
    b = _mesh(other_vertices, other_faces, 'Other')
    report = {
        'method': 'continuous rigid-translation triangle SAT with swept AABB pair traversal',
        'timeDomain': [0.0, 1.0],
        'spatialTolerance': tolerance,
        'movingTriangles': len(a),
        'otherTriangles': len(b),
        'candidatePairs': 0,
        'testedPairs': 0,
        'aabbNodePairTests': 0,
        'collisions': [],
        'requiresContainmentCheck': True,
        'limitations': 'Surface contact intervals only. A fully enclosed solid can be disjoint from another solid surface. Rotation and deformation are outside this function; validate them separately.',
    }
    if not len(a) or not len(b):
        return report
    start_lo, start_hi = a.min(1), a.max(1)
    a_lo = np.minimum(start_lo, start_lo + delta)
    a_hi = np.maximum(start_hi, start_hi + delta)
    b_lo, b_hi = b.min(1), b.max(1)
    for ia, ib in _candidate_batches(a_lo, a_hi, b_lo, b_hi, tolerance, report):
        report['candidatePairs'] += len(ia)
        report['testedPairs'] += len(ia)
        hit, enter, leave = _intervals(a[ia], b[ib], delta, tolerance)
        for row in np.flatnonzero(hit):
            first, last = float(enter[row]), float(leave[row])
            report['collisions'].append({
                'movingTriangle': int(ia[row]),
                'otherTriangle': int(ib[row]),
                'tEnter': first,
                'tExit': last,
                'atStart': first == 0.0,
                'atEnd': last == 1.0,
                'instantaneous': first == last,
            })
    report['collisions'].sort(key=lambda item: (item['tEnter'], item['movingTriangle'], item['otherTriangle']))
    return report
