"""Export the current saved environment without reapplying recovery-time colours."""
import bpy, json, struct, sys, array
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
output = Path(sys.argv[sys.argv.index('--out')+1]) if '--out' in sys.argv else ROOT / 'public/assets/rebuild'
output.mkdir(parents=True, exist_ok=True)
names = sys.argv[sys.argv.index('--only')+1].split(',') if '--only' in sys.argv else ['garage', 'world']
if any(name not in ['garage', 'world'] for name in names):
    raise ValueError('Expected garage or world')
for name in names:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets-sources/rebuilt-unity' / f'{name}.blend'))
    destination = output / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', export_extras=True,
                              export_animations=False, export_draco_mesh_compression_enable=name == 'world',
                              export_draco_mesh_compression_level=6)
    if name == 'world':
        raw = destination.read_bytes()
        size = struct.unpack_from('<I', raw, 12)[0]
        gltf = json.loads(raw[20:20+size])
        for material in gltf.get('materials', []):
            if 'Foliage' in material.get('name', ''):
                material.update(alphaMode='MASK', alphaCutoff=.38, doubleSided=True)
        encoded = json.dumps(gltf, separators=(',', ':')).encode()
        encoded += b' ' * ((-len(encoded)) % 4)
        tail = raw[20+size:]
        destination.write_bytes(struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(tail)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + tail)
        # Keep native full-course tests in sync with the actual edited world.
        fixture_dir = output if '--out' in sys.argv else ROOT / 'artifacts/unity-recovery'
        fixture_dir.mkdir(parents=True, exist_ok=True)
        bpy.context.view_layer.update()
        chunks, entries, offset = [], [], 0
        for obj in bpy.context.scene.objects:
            if obj.type != 'MESH' or not obj.get('unity_collider'):
                continue
            obj.data.calc_loop_triangles()
            vertices, indices = array.array('f'), array.array('I')
            for vertex in obj.data.vertices:
                point = obj.matrix_world @ vertex.co
                vertices.extend((point.x, point.z, -point.y))
            for triangle in obj.data.loop_triangles:
                indices.extend(triangle.vertices)
            vb, ib = vertices.tobytes(), indices.tobytes()
            entries.append(dict(name=obj.name, offset=offset, vertices=len(vertices), indices=len(indices)))
            chunks.extend((vb, ib)); offset += len(vb) + len(ib)
        (fixture_dir / 'colliders.bin').write_bytes(b''.join(chunks))
        (fixture_dir / 'colliders.json').write_text(json.dumps(entries), encoding='utf-8')
