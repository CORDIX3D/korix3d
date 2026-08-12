import json
import os
import sys

import FreeCAD
import Mesh
import Part


def fail(message):
    raise RuntimeError(message)


input_path = os.path.abspath(os.environ.get("KORIX_STEP_INPUT", ""))
output_path = os.path.abspath(os.environ.get("KORIX_STEP_OUTPUT", ""))
if not os.environ.get("KORIX_STEP_INPUT") or not os.environ.get("KORIX_STEP_OUTPUT"):
    fail("Missing isolated STEP conversion paths")
if not os.path.isfile(input_path):
    fail("STEP input file does not exist")
if os.path.splitext(input_path)[1].lower() not in (".step", ".stp"):
    fail("STEP converter received an unsupported input extension")
if os.path.splitext(output_path)[1].lower() != ".stl":
    fail("STEP converter output must use the STL extension")

document = FreeCAD.newDocument("KORIX3D_STEP_CONVERSION")
try:
    Part.insert(input_path, document.Name)
    document.recompute()
    printable_objects = [
        item
        for item in document.Objects
        if hasattr(item, "Shape") and not item.Shape.isNull()
    ]
    if not printable_objects:
        fail("STEP file does not contain printable solid geometry")

    Mesh.export(printable_objects, output_path)
    if not os.path.isfile(output_path) or os.path.getsize(output_path) <= 84:
        fail("FreeCAD did not create a valid STL mesh")

    print(
        json.dumps(
            {
                "objectCount": len(printable_objects),
                "outputBytes": os.path.getsize(output_path),
            }
        )
    )
finally:
    FreeCAD.closeDocument(document.Name)
