import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
stage=sys.argv[sys.argv.index('--stage')+1]
ids=sys.argv[sys.argv.index('--ids')+1].split(',') if '--ids' in sys.argv else ['supra','huracan']
for id in ids:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets-sources/vehicles-v6/{id}.blend'))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16
 scene.cycles.use_denoising=True;scene.render.resolution_x=1000;scene.render.resolution_y=650;scene.render.resolution_percentage=100
 world=bpy.data.worlds.new('Reference neutral studio');world.use_nodes=True
 world.node_tree.nodes.get('Background').inputs[0].default_value=(.06,.075,.10,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.55;scene.world=world
 for o in list(scene.objects):
  if o.type in ['CAMERA','LIGHT']:bpy.data.objects.remove(o,do_unlink=True)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012))
 floor=bpy.context.object;mat=bpy.data.materials.new('Inspection_Floor');mat.diffuse_color=(.08,.10,.13,1);floor.data.materials.append(mat)
 for name,p,size,power in [('Key',(-3,-4,6),5,1600),('Rim',(4,1,4),4,1800),('Top',(0,1,7),4,1500)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size;data.size_y=1.2
  light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=p;light.rotation_euler=(Vector((0,0,.7))-light.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(5.7,-7.6,3.35));camera=bpy.context.object;camera.rotation_euler=(Vector((0,-.05,.65))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.4;scene.camera=camera
 scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/f'artifacts/vehicle-polish-3pass-20261015/{stage}-{id}-blender.png')
 bpy.ops.render.render(write_still=True)
