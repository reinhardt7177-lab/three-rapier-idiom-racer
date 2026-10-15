"""Batch export copies by mechanical parent/material; editable sources stay apart."""
import bpy

def web_meshes():
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.update()
    groups = {}
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and len(obj.data.materials) == 1:
            groups.setdefault((obj.parent, obj.data.materials[0]), []).append(obj)
    for (parent, material), objects in groups.items():
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        bpy.context.object.name = f'Web_{parent.name if parent else "root"}_{material.name}'
    return sum(obj.type == 'MESH' for obj in bpy.context.scene.objects)
