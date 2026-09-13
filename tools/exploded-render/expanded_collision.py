"""Expanded-assembly checks with an explicit source-unit seam tolerance."""
import numpy as np
from mathutils import Vector
from translation_collision import check_translation

INITIAL_SEAM_TOLERANCE = 2e-6

def _depth(points, components):
    deepest = 0.0
    direction = Vector((.819172513,.371829101,.436291787)).normalized()
    for component in components:
        candidates = points[np.all(points > component['lo']+1e-6,axis=1) & np.all(points < component['hi']-1e-6,axis=1)]
        for point in candidates:
            nearest,_,_,distance=component['bvh'].find_nearest(Vector(point))
            if nearest is None or distance <= 1e-5: continue
            origin=Vector(point);crossings=0;previous=-1
            for _ in range(128):
                hit,_,index,_=component['bvh'].ray_cast(origin,direction)
                if hit is None: break
                if index != previous: crossings+=1
                previous=index;origin=hit+direction*1e-6
            else: crossings=1
            if crossings%2: deepest=max(deepest,distance)
    return deepest

def _pair_depth(moving,other,offset):
    return max(_depth(moving.probes+offset-other.offset,other.closed_components),
               _depth(other.probes+other.offset-offset,moving.closed_components))

def _sampled_check(moving,delta,groups,samples,withdrawal_fraction):
    ts=sorted(set([.0001,.001,.005,.01]+np.linspace(0,1,samples)[1:].tolist()))
    baseline={g.name:_pair_depth(moving,g,np.zeros(3)) for g in groups if g is not moving and moving.near(g,np.zeros(3))}
    tested=0
    for t in ts:
        offset=delta*t
        if moving.lo[2]+offset[2] < -1e-5: return False,{'reason':'floor','t':t}
        for other in groups:
            if other is moving or not moving.near(other,offset): continue
            tested+=1
            depth=_pair_depth(moving,other,offset)
            if depth > baseline.get(other.name,0)+.0002:
                return False,{'reason':'solid_penetration_increased','obstacle':other.name,'t':t,'depth':depth,'baselineDepth':baseline.get(other.name,0)}
            if t>withdrawal_fraction and depth>.0002:
                return False,{'reason':'retained_solid_containment','obstacle':other.name,'t':t,'depth':depth}
    return True,{'positiveSamples':len(ts),'containmentPairTests':tested,'floorCrossings':0}

def _coplanar_slide(a,b,delta,t):
    """Parallel coincident triangle planes with no normal velocity only.

    A face approaching another face is never classified as a slide. Nonparallel
    edge/face contacts continue through the normal collision policy.
    """
    na=np.cross(a[1]-a[0],a[2]-a[0]);nb=np.cross(b[1]-b[0],b[2]-b[0])
    la=np.linalg.norm(na);lb=np.linalg.norm(nb)
    if min(la,lb)<1e-15: return False
    na/=la;nb/=lb
    return bool(np.linalg.norm(np.cross(na,nb))<1e-7 and abs(np.dot(delta,nb))<1e-9 and
                np.max(np.abs((a+delta*t-b[0])@nb))<1e-8)

def check_expanded_translation(moving, delta, groups, samples=33, withdrawal_fraction=.25):
    delta = np.asarray(delta, dtype=float)
    passed, report = _sampled_check(moving, delta, groups, samples=samples,withdrawal_fraction=withdrawal_fraction)
    if not passed:
        return passed, report
    travel = float(np.linalg.norm(delta))
    swept_lo = np.minimum(moving.lo, moving.lo+delta)
    swept_hi = np.maximum(moving.hi, moving.hi+delta)
    tested = candidates = contacts = seam_contacts = sliding_contacts = 0
    maximum_seam_distance = 0.0
    for other in groups:
        if other is moving or np.any(swept_hi < other.lo+other.offset) or np.any(other.hi+other.offset < swept_lo):
            continue
        ccd = check_translation(moving.vertices, moving.faces, other.vertices+other.offset,
                                other.faces, delta, tolerance=1e-8)
        tested += ccd['testedPairs']; candidates += ccd['candidatePairs']
        for hit in ccd['collisions']:
            a=moving.vertices[np.asarray(moving.faces[hit['movingTriangle']])]
            b=other.vertices[np.asarray(other.faces[hit['otherTriangle']])]+other.offset
            if _coplanar_slide(a,b,delta,(hit['tEnter']+hit['tExit'])*.5):
                sliding_contacts+=1
                continue
            contact_distance = hit['tEnter'] * travel
            if (hit['tEnter'] <= 1e-6 or contact_distance <= INITIAL_SEAM_TOLERANCE) and hit['tExit'] <= withdrawal_fraction:
                contacts += 1
                if hit['tEnter'] > 1e-6:
                    seam_contacts += 1
                    maximum_seam_distance = max(maximum_seam_distance, contact_distance)
                continue
            return False, {'reason':'continuous_triangle_contact','t':hit['tEnter'],
                'obstacle':other.name,'contact':hit,'continuousTriangleTests':tested,
                'initialSeamToleranceSourceUnits':INITIAL_SEAM_TOLERANCE}
    report.update(continuousTriangleTests=tested,continuousCandidatePairs=candidates,
        initialTriangleContactsWithdrawing=contacts,newContinuousTriangleContacts=0,
        initialSeamToleranceSourceUnits=INITIAL_SEAM_TOLERANCE,
        initialSeamContacts=seam_contacts,maximumInitialSeamContactTravel=maximum_seam_distance,
        coplanarTangentialContactIntervals=sliding_contacts,
        modelBoundsDiagonal=float(np.linalg.norm(moving.hi-moving.lo)))
    report['sourceContactWithdrawalFractionOfThisSegment']=withdrawal_fraction
    return True, report
