"""Develop the supplied perforated aluminum seat along its actual sheet bends.

The original CAD remains untouched. Its animated surface remains one piece;
two tiny upper corner returns receive explicit render-only reliefs because their
source developed footprints overlap the head flange. No other sections, panels,
holes, or outline are recreated. Planar skins and thickness walls identify
the bend tree. Rigid panels rotate about measured tangent lines; existing bend
vertices develop continuously at constant neutral-axis arc length.

Public interface: build_unfold(objects, scene) -> controller. The controller
exposes objects, parts, report and seekable apply(progress), from 0 through 1.
"""
from collections import defaultdict
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.geometry import tessellate_polygon


def _unit(v):
    return v / np.linalg.norm(v)


def _rotation(axis, angle):
    x, y, z = axis
    cross = np.array(((0, -z, y), (z, 0, -x), (-y, x, 0)))
    return np.eye(3) * math.cos(angle) + (1 - math.cos(angle)) * np.outer(axis, axis) + math.sin(angle) * cross


def _smooth(value, start, end):
    t = min(1., max(0., (value - start) / (end - start)))
    return t * t * (3 - 2 * t)


def _recover(points, faces, normals, areas):
    """Recover planar connected skins, then the intervening cylindrical strips."""
    centers = points[faces].mean(1)
    # Welding here is exclusively an adjacency lookup. Render topology is intact.
    _, inverse = np.unique(np.round(points, 6), axis=0, return_inverse=True)
    welded = inverse[faces]
    edges = defaultdict(list)
    for index, vs in enumerate(welded):
        for u, v in zip(vs, np.roll(vs, 1)):
            edges[tuple(sorted((int(u), int(v))))].append(index)
    adjacent = [set() for _ in faces]
    for ids in edges.values():
        for i in ids:
            adjacent[i].update(j for j in ids if i != j)

    def plane(ids, normal):
        normal = _unit((normals[ids] * np.sign(normals[ids] @ normal)[:, None] * areas[ids, None]).sum(0))
        offsets = centers[ids] @ normal
        return dict(normal=normal, d=float((offsets.min() + offsets.max()) / 2),
                    thickness=float(offsets.max() - offsets.min()), seeds=np.array(ids, dtype=int))

    remaining = np.ones(len(faces), dtype=bool)
    planes = []
    for i in np.argsort(-areas):
        if not remaining[i]:
            continue
        nn = normals[i].copy()
        if nn[np.argmax(abs(nn))] < 0:
            nn *= -1
        ids = np.where(remaining & (abs(normals @ nn) > .999995) & (abs((centers - centers[i]) @ nn) < .0051))[0]
        remaining[ids] = False
        if areas[ids].sum() < .013:
            continue
        planes.append(plane(ids, nn))
    thickness = float(np.median([g['thickness'] for g in planes]))
    panels = []
    for g in planes:
        eligible = abs(points @ g['normal'] - g['d'])[faces].max(1) < thickness / 2 + 8e-6
        remaining_ids = set(np.where(eligible)[0])
        seeds = set(g['seeds'])
        while remaining_ids:
            i = remaining_ids.pop()
            ids = {i}
            queue = [i]
            while queue:
                other = adjacent[queue.pop()] & remaining_ids
                remaining_ids -= other
                ids |= other
                queue.extend(other)
            good = sorted(ids & seeds)
            if areas[good].sum() > .005:
                panels.append({**g, 'seeds': np.array(good, dtype=int)})

    def classify():
        labels = np.full(len(faces), -1, dtype=int)
        for number, g in enumerate(panels):
            eligible = abs(points @ g['normal'] - g['d'])[faces].max(1) < thickness / 2 + 8e-6
            queue = list(g['seeds'])
            labels[queue] = number
            while queue:
                for j in adjacent[queue.pop()]:
                    if labels[j] < 0 and eligible[j]:
                        labels[j] = number
                        queue.append(j)
        remaining_ids = set(np.where(labels < 0)[0])
        regions = []
        while remaining_ids:
            i = remaining_ids.pop()
            ids, queue, border = {i}, [i], set()
            while queue:
                for j in adjacent[queue.pop()]:
                    if labels[j] >= 0:
                        border.add(int(labels[j]))
                    elif j in remaining_ids:
                        remaining_ids.remove(j)
                        ids.add(j)
                        queue.append(j)
            regions.append(dict(faces=np.array(sorted(ids), dtype=int), border=sorted(border)))
        return labels, regions

    # Small return tabs are below the broad-panel threshold. A remaining region
    # attached to just one panel reveals each actual tab without inventing cuts.
    for _ in range(8):
        labels, regions = classify()
        additions = []
        for region in regions:
            if len(region['border']) != 1:
                continue
            ids = region['faces']
            parent = panels[region['border'][0]]
            if abs(points[np.unique(faces[ids])] @ parent['normal'] - parent['d']).max() < thickness / 2 + 2e-5:
                continue
            i = max(ids, key=lambda index: areas[index])
            nn = normals[i]
            selected = ids[(abs(normals[ids] @ nn) > .999995) & (abs((centers[ids] - centers[i]) @ nn) < thickness * 1.04)]
            new = plane(selected, nn)
            if new['thickness'] < thickness * .9:
                raise ValueError('A residual seat region has no paired planar sheet skins')
            additions.append(new)
        if not additions:
            break
        panels.extend(additions)
    else:
        raise ValueError('Seat panel recovery did not converge')
    labels, regions = classify()
    bends = []
    for region in regions:
        if len(region['border']) == 1:
            labels[region['faces']] = region['border'][0]
        elif len(region['border']) == 2:
            bends.append(region)
        else:
            raise ValueError('Seat bends must join exactly two planar panels')
    for number, panel in enumerate(panels):
        panel['faces'] = np.where(labels == number)[0]
        panel['vertices'] = np.unique(faces[panel['faces']])
        panel['center'] = np.average(centers[panel['seeds']], axis=0, weights=areas[panel['seeds']])
    if len(bends) != len(panels) - 1:
        raise ValueError('Recovered seat panel graph is not a bend tree')
    return panels, bends, thickness


class SeatUnfold:
    def __init__(self, objects, scene):
        if len(objects) != 1 or len(objects[0].data.polygons) != 9526:
            raise ValueError('Seat unfolding requires the intact original 9,526-face driverseat mesh')
        self.objects = list(objects)
        self.scene = scene
        self.object = objects[0]
        self.mesh = self.object.data
        if not self.object.matrix_world.is_identity:
            raise ValueError('Stage the driverseat into world coordinates before unfolding')
        self.original = np.array([v.co[:] for v in self.mesh.vertices])
        self.faces = np.array([list(face.vertices) for face in self.mesh.polygons])
        self.original_normals = np.array([n.vector[:] for n in self.mesh.corner_normals])
        self.loop_vertices = np.array([loop.vertex_index for loop in self.mesh.loops])
        normals = np.array([face.normal[:] for face in self.mesh.polygons])
        areas = np.array([face.area for face in self.mesh.polygons])
        self.panels, regions, self.thickness = _recover(self.original, self.faces, normals, areas)
        # The perforated pan is the large nearly horizontal panel.
        self.root = max((i for i, p in enumerate(self.panels) if abs(p['normal'][2]) > .95),
                        key=lambda i: areas[self.panels[i]['seeds']].sum())
        self.normal = self.panels[self.root]['normal'].copy()
        if self.normal[2] < 0:
            self.normal *= -1
        links = defaultdict(list)
        for region in regions:
            a, b = region['border']
            links[a].append((b, region))
            links[b].append((a, region))
        oriented = {self.root: self.normal}
        queue = [self.root]
        self.bends = []
        self.panel_parent = {self.root: None}
        for parent in queue:
            for child, region in links[parent]:
                if child in oriented:
                    continue
                pp, cp = self.panels[parent], self.panels[child]
                normal = oriented[parent]
                childnormal = cp['normal']
                axis = _unit(np.cross(normal, childnormal))
                midplanes = np.stack((normal, childnormal, axis))
                offsets = (pp['d'] * np.sign(normal @ pp['normal']), cp['d'], 0)
                intersection = np.linalg.solve(midplanes, offsets)
                tangent = _unit(np.cross(normal, axis))
                if (pp['center'] - intersection) @ tangent > 0:
                    tangent *= -1
                axis = np.cross(tangent, normal)
                childtangent = _unit(np.cross(childnormal, axis))
                if (cp['center'] - intersection) @ childtangent < 0:
                    childtangent *= -1
                angle = math.atan2(childtangent @ normal, childtangent @ tangent)
                oriented[child] = _rotation(axis, angle) @ normal
                self.panel_parent[child] = parent
                queue.append(child)
                bend_vertices = np.unique(self.faces[region['faces']])
                seam = np.intersect1d(np.unique(self.faces[pp['seeds']]), bend_vertices)
                if not len(seam):
                    raise ValueError('Recovered bend has no source tangent boundary')
                distance = float(np.median((self.original[seam] - intersection) @ tangent))
                origin = intersection + distance * tangent
                radius = -distance / math.tan(angle / 2)
                if radius * angle <= 0 or abs(radius) > .1:
                    raise ValueError(f'Invalid measured bend radius: {parent}, {child}, {radius}')
                endpoint = origin + radius * (math.sin(angle) * tangent + (1 - math.cos(angle)) * normal)
                # Interior source bend vertices get cylindrical development;
                # shared tangent vertices are owned by their rigid planar skin.
                rigid_vertices = np.union1d(pp['vertices'], cp['vertices'])
                interior = np.setdiff1d(bend_vertices, rigid_vertices)
                relative = self.original[interior] - origin - radius * normal
                x, y = relative @ tangent, relative @ normal
                phi = np.arctan2(x * np.sign(radius), -y * np.sign(radius))
                height = radius - np.sign(radius) * np.sqrt(x * x + y * y)
                bend = dict(parent=parent, child=child, axis=axis, normal=normal,
                            tangent=tangent, origin=origin, radius=radius, angle=angle,
                            endpoint=endpoint, vertices=interior, phi=phi, height=height,
                            axial=relative @ axis, faces=region['faces'])
                self.bends.append(bend)
        # Thickness end caps can lie inside both neighboring plane slabs. Their
        # vertices belong to the real curved bend, never to two rigid panels.
        curved_vertices = set()
        primary_vertices = np.unique(np.concatenate([np.unique(self.faces[p['seeds']]) for p in self.panels]))
        for bend in self.bends:
            pp, cp = self.panels[bend['parent']], self.panels[bend['child']]
            candidates = np.unique(np.concatenate((pp['vertices'], cp['vertices'],
                                                    np.unique(self.faces[bend['faces']]))))
            relative = self.original[candidates] - bend['origin'] - bend['radius'] * bend['normal']
            x, y = relative @ bend['tangent'], relative @ bend['normal']
            radius = bend['radius']
            phi = np.arctan2(x * np.sign(radius), -y * np.sign(radius))
            height = radius - np.sign(radius) * np.sqrt(x * x + y * y)
            fraction = phi / bend['angle']
            axial = relative @ bend['axis']
            source_axial = (self.original[np.unique(self.faces[bend['faces']])] - bend['origin']) @ bend['axis']
            belongs = ((fraction > 1e-5) & (fraction < 1 - 1e-5)
                       & (abs(height) < self.thickness / 2 + 1e-5)
                       & (axial > source_axial.min() - 1e-5) & (axial < source_axial.max() + 1e-5))
            belongs &= ~np.isin(candidates, primary_vertices)
            bend.update(vertices=candidates[belongs], phi=phi[belongs], height=height[belongs], axial=axial[belongs])
            curved_vertices.update(map(int, candidates[belongs]))
        curved_vertices = np.array(sorted(curved_vertices), dtype=int)
        for panel in self.panels:
            panel['vertices'] = np.setdiff1d(panel['vertices'], curved_vertices)
        for i, panel in enumerate(self.panels):
            own_primary = np.unique(self.faces[panel['seeds']])
            others_primary = np.unique(np.concatenate([np.unique(self.faces[p['seeds']]) for j, p in enumerate(self.panels) if i != j]))
            panel['vertices'] = np.setdiff1d(panel['vertices'], np.setdiff1d(others_primary, own_primary))
        self.order = queue
        self.oriented = oriented
        self._make_corner_reliefs()
        self.parts = [{'object': self.display_object, 'name': 'Continuous perforated aluminum blank',
                       'group': 'sheet_metal_unfold'}]
        self.report = {
            'mode': 'unfold', 'source': 'models/real/driverseat.glb',
            'geometryPolicy': 'The real perforated seat develops as one continuous sheet. Planar panels move rigidly along recovered source bends; curved strips develop continuously at constant neutral-axis arc length. Two tiny upper corner return tabs and their bends receive render-only corner reliefs because their exact flat footprints overlap the head flange. All main perforations and the remaining outline are preserved. The source GLB and approved cover remain unchanged.',
            'panelCount': len(self.panels), 'bendCount': len(self.bends),
            'visiblePanelCount': len(self.panels) - 2, 'visibleBendCount': len(self.bends) - 2,
            'sourceFaceCount': len(self.faces), 'sourceVertexCount': len(self.original),
            'sheetThicknessSceneUnits': self.thickness,
            'bendAllowancePolicy': 'Mid-thickness neutral surface recovered from the supplied inner and outer skins; visual development, not a production blank with material-specific K-factor.',
            'stagingPolicy': 'The complete connected blank levels by the original pan inclination during unfolding; a small rigid lift keeps every posed vertex above the fixed photographic ground.',
            'cornerReliefs': self.relief_report,
            'bends': [{'parent': b['parent'], 'child': b['child'],
                       'foldDegrees': math.degrees(b['angle']), 'neutralRadius': abs(b['radius']),
                       'neutralArcLength': b['radius'] * b['angle']} for b in self.bends],
        }
        self.apply(0)

    def _make_corner_reliefs(self):
        """Trim only the two colliding leaf returns at their parent tangent edge.

        New edge vertices retain barycentric coordinates in the source triangles;
        the original deformation therefore drives the relief surface directly.
        The two exposed thickness edges are capped, keeping a closed single mesh.
        """
        positions = [p.copy() for p in self.original]
        weights = [{i: 1.} for i in range(len(positions))]
        cut_parents = {}
        polygons = [(list(map(int, face)), i) for i, face in enumerate(self.faces)]
        # These are geometrically identified unperforated upper inward returns.
        # Their small planes are almost vertical in the folded source, normal X.
        leaves = [i for i, p in enumerate(self.panels)
                  if abs(p['normal'][0]) > .99 and p['center'][2] > 1.6
                  and abs(p['center'][1]) > .6 and len(p['seeds']) == 4]
        if len(leaves) != 2:
            raise ValueError('Expected the two documented upper corner return tabs')
        removed = []
        outward = []
        for child in leaves:
            bend = next(b for b in self.bends if b['child'] == child)
            parent = self.panels[bend['parent']]
            selected = set(map(int, np.concatenate((parent['faces'], self.panels[child]['faces'], bend['faces']))))
            normal = bend['tangent']
            # Put the relief 0.0002 scene units inside the rigid tangent skin,
            # avoiding coincident STL endpoints at the cylinder/plane seam.
            origin = bend['origin'] - .0002 * normal
            outward.append((origin, normal))
            cache = {}
            replacement = []
            for polygon, source in polygons:
                if source not in selected:
                    replacement.append((polygon, source))
                    continue
                clipped = []
                for previous, current in zip(polygon[-1:] + polygon[:-1], polygon):
                    a = float((positions[previous] - origin) @ normal)
                    b = float((positions[current] - origin) @ normal)
                    inside_a, inside_b = a <= 1e-10, b <= 1e-10
                    if inside_a != inside_b:
                        edge = tuple(sorted((previous, current)))
                        if edge not in cache:
                            t = a / (a - b)
                            point = positions[previous] * (1 - t) + positions[current] * t
                            blend = defaultdict(float)
                            for v, w in weights[previous].items():
                                blend[v] += w * (1 - t)
                            for v, w in weights[current].items():
                                blend[v] += w * t
                            cache[edge] = len(positions)
                            cut_parents[len(positions)] = bend['parent']
                            positions.append(point)
                            weights.append(dict(blend))
                        clipped.append(cache[edge])
                    if inside_b:
                        clipped.append(current)
                if len(clipped) >= 3:
                    replacement.append((clipped, source))
                else:
                    removed.append(source)
            polygons = replacement

        counts = defaultdict(int)
        for polygon, _ in polygons:
            for u, v in zip(polygon, polygon[1:] + polygon[:1]):
                counts[tuple(sorted((u, v)))] += 1
        boundary = defaultdict(set)
        for (u, v), count in counts.items():
            if count == 1:
                boundary[u].add(v)
                boundary[v].add(u)
        if any(len(neighbors) != 2 for neighbors in boundary.values()):
            raise ValueError('Corner relief did not create simple closed thickness edges')
        loops = []
        while boundary:
            start = next(iter(boundary))
            loop = [start]
            previous = None
            current = start
            while True:
                following = next(v for v in boundary[current] if v != previous)
                previous, current = current, following
                if current == start:
                    break
                loop.append(current)
            for index in loop:
                del boundary[index]
            center = np.mean([positions[i] for i in loop], axis=0)
            _, normal = min(outward, key=lambda item: abs((center - item[0]) @ item[1]))
            polygon_normal = np.zeros(3)
            for u, v in zip(loop, loop[1:] + loop[:1]):
                polygon_normal += np.cross(positions[u] - center, positions[v] - center)
            if polygon_normal @ normal < 0:
                loop.reverse()
            polygons.append((loop, -1))
            loops.append(loop)
        if len(loops) != 2:
            raise ValueError(f'Expected two corner relief cap loops, got {len(loops)}')

        triangles = []
        for polygon, source in polygons:
            if len(polygon) == 3 and source >= 0:
                triangles.append((polygon, source))
                continue
            vectors = [Vector(positions[i]) for i in polygon]
            lookup = {tuple(v): i for v, i in zip(vectors, polygon)}
            for tri in tessellate_polygon([vectors]):
                face = [polygon[v] if isinstance(v, int) else lookup[tuple(v)] for v in tri]
                p = np.array([positions[i] for i in face])
                if np.linalg.norm(np.cross(p[1] - p[0], p[2] - p[0])) > 1e-14:
                    triangles.append((face, source))
        used = sorted({v for face, _ in triangles for v in face})
        remap = {old: new for new, old in enumerate(used)}
        self.render_faces = np.array([[remap[v] for v in face] for face, _ in triangles], dtype=int)
        self.render_vertex_sources = np.zeros((len(used), 3), dtype=int)
        self.render_vertex_weights = np.zeros((len(used), 3))
        self.rigid_cut_vertices = [(i, cut_parents[v], positions[v]) for i, v in enumerate(used) if v in cut_parents]
        for i, v in enumerate(used):
            for j, (source, weight) in enumerate(weights[v].items()):
                self.render_vertex_sources[i, j] = source
                self.render_vertex_weights[i, j] = weight
        self.render_loop_sources = np.zeros((len(triangles) * 3, 3), dtype=int)
        self.render_loop_weights = np.zeros((len(triangles) * 3, 3))
        self.cap_faces = []
        self.render_source_faces = np.array([source for _, source in triangles], dtype=int)
        for i, (face, source) in enumerate(triangles):
            if source == -1:
                self.cap_faces.append(i)
                continue
            lookup = {int(v): source * 3 + j for j, v in enumerate(self.faces[source])}
            for corner, vertex in enumerate(face):
                for j, (original, weight) in enumerate(weights[vertex].items()):
                    self.render_loop_sources[i * 3 + corner, j] = lookup[original]
                    self.render_loop_weights[i * 3 + corner, j] = weight
        data = bpy.data.meshes.new('Driver seat continuous unfolding surface with two corner reliefs')
        data.from_pydata([positions[i] for i in used], [], self.render_faces.tolist())
        for material in self.mesh.materials:
            data.materials.append(material)
        for face in data.polygons:
            face.use_smooth = face.index not in self.cap_faces
        self.display_object = bpy.data.objects.new(data.name, data)
        bpy.context.collection.objects.link(self.display_object)
        self.object.hide_render = True
        self.object.hide_set(True)
        self.objects = [self.display_object]
        self.relief_report = {
            'count': 2, 'location': 'Small unperforated inward return at each upper shoulder-rim end',
            'reason': 'Exact development of these supplied CAD returns overlaps the integral head flange; trimming their render-only tangent ends clears that footprint.',
            'removedLeafPanelIds': leaves, 'fullyRemovedSourceTriangles': len(set(removed)),
            'retainedSourceTriangles': len(set(self.render_source_faces[self.render_source_faces >= 0].tolist())),
            'renderTrianglesIncludingClippedFacesAndCaps': len(self.render_faces),
            'capTriangles': len(self.cap_faces), 'sourceFilesModified': False,
        }

    def _amount(self, bend, progress):
        # Clear back sidewalls before pan sidewalls; their original narrow hems
        # otherwise sweep through each other. Shoulder rims/returns open together.
        child = bend['child']
        if child in (7, 9):
            return _smooth(progress, .24, .48)
        if child in (8, 10):
            return _smooth(progress, 0., .24)
        if child in (0, 2):
            return _smooth(progress, .05, .4)
        if child == 5:
            return _smooth(progress, .1, .4)
        if child in (3, 4, 15, 16, 18, 19, 21, 22):
            return _smooth(progress, .30, .65)
        if bend['angle'] < 0:
            return _smooth(progress, .35, .65)
        if child in (17, 20):
            return _smooth(progress, .60, .85)
        return _smooth(progress, .5, 1.)

    def apply(self, progress):
        progress = min(1., max(0., float(progress)))
        result = self.original.copy()
        rotations = np.broadcast_to(np.eye(3), (len(result), 3, 3)).copy()
        transforms = {self.root: (np.eye(3), np.zeros(3))}
        for bend in self.bends:
            amount = self._amount(bend, progress)
            k = 1 - amount
            theta = bend['angle'] * k
            length = bend['radius'] * bend['angle']
            tangent, normal, axis = bend['tangent'], bend['normal'], bend['axis']
            if k > 1e-7:
                endpoint = bend['origin'] + length / theta * (math.sin(theta) * tangent + (1 - math.cos(theta)) * normal)
            else:
                endpoint = bend['origin'] + length * tangent
            local_rotation = _rotation(axis, theta - bend['angle'])
            local_offset = endpoint - local_rotation @ bend['endpoint']
            parent_rotation, parent_offset = transforms[bend['parent']]
            transforms[bend['child']] = (parent_rotation @ local_rotation,
                                         parent_rotation @ local_offset + parent_offset)
            ids = bend['vertices']
            phi, height = bend['phi'], bend['height']
            new_phi = k * phi
            if k > 1e-7:
                radius = bend['radius'] / k
                xx = (radius - height) * np.sin(new_phi)
                yy = radius * (1 - np.cos(new_phi)) + height * np.cos(new_phi)
            else:
                xx, yy = bend['radius'] * phi, height
            native = bend['origin'] + xx[:, None] * tangent + yy[:, None] * normal + bend['axial'][:, None] * axis
            result[ids] = native @ parent_rotation.T + parent_offset
            for index, angular in zip(ids, new_phi - phi):
                rotations[index] = parent_rotation @ _rotation(axis, float(angular))
        for index, panel in enumerate(self.panels):
            rotation, offset = transforms[index]
            ids = panel['vertices']
            result[ids] = self.original[ids] @ rotation.T + offset
            rotations[ids] = rotation
        # Level the complete sheet as the back lowers. The original pan has a
        # 4.7-degree installation pitch; retaining that pitch would put the
        # developed back below the fixed photographic ground.
        world_up = np.array((0., 0., 1.))
        leveling_axis = _unit(np.cross(self.normal, world_up))
        leveling_angle = math.acos(float(self.normal @ world_up)) * _smooth(progress, .30, 1.)
        leveling = _rotation(leveling_axis, leveling_angle)
        result = result @ leveling.T
        rotations = np.einsum('ij,njk->nik', leveling, rotations)
        staging_lift = max(0., .0055 - result[:, 2].min())
        result[:, 2] += staging_lift
        # At p=0, retain the exact source coordinates and original shading bytes.
        if progress == 0:
            result = self.original.copy()
            corner_normals = self.original_normals
        else:
            corner_normals = np.einsum('nij,nj->ni', rotations[self.loop_vertices], self.original_normals)
        self.mesh.vertices.foreach_set('co', result.astype(np.float32).ravel())
        self.mesh.update()
        self.mesh.normals_split_custom_set(corner_normals.tolist())
        rendered = np.sum(result[self.render_vertex_sources] * self.render_vertex_weights[:, :, None], axis=1)
        for vertex, parent, position in self.rigid_cut_vertices:
            rotation, offset = transforms[parent]
            rendered[vertex] = leveling @ (rotation @ position + offset)
            rendered[vertex, 2] += staging_lift
        display_normals = np.sum(corner_normals[self.render_loop_sources] * self.render_loop_weights[:, :, None], axis=1)
        for face in self.cap_faces:
            p = rendered[self.render_faces[face]]
            normal = _unit(np.cross(p[1] - p[0], p[2] - p[0]))
            display_normals[face * 3:face * 3 + 3] = normal
        self.display_object.data.vertices.foreach_set('co', rendered.astype(np.float32).ravel())
        self.display_object.data.update()
        self.display_object.data.normals_split_custom_set(display_normals.tolist())
        self.scene.view_layers[0].update()
        self.points = result
        self.render_points = rendered
        self.current_normal = leveling @ self.normal
        return self


def build_unfold(objects, scene):
    return SeatUnfold(objects, scene)
