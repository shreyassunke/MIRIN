import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createShoulderPressModel } from "./createShoulderPressModel";

describe("createShoulderPressModel", () => {
  it("builds a tall station with a press axle, both grips, and a stack", () => {
    const root = createShoulderPressModel();
    root.updateWorldMatrix(true, true);

    const pivot = root.getObjectByName("pressPivot");
    const left = root.getObjectByName("gripLeft");
    const right = root.getObjectByName("gripRight");
    const stack = root.getObjectByName("weightStack");
    expect(pivot).toBeTruthy();
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(stack).toBeTruthy();
    expect(root.getObjectByName("seat")).toBeTruthy();
    expect(root.getObjectByName("backPad")).toBeTruthy();

    const lp = new THREE.Vector3();
    const rp = new THREE.Vector3();
    const sp = new THREE.Vector3();
    left!.getWorldPosition(lp);
    right!.getWorldPosition(rp);
    stack!.getWorldPosition(sp);
    expect(lp.x).toBeLessThan(rp.x);
    expect(Math.abs(lp.y - rp.y)).toBeLessThan(0.2);
    expect(sp.x).toBeLessThan((lp.x + rp.x) / 2);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(size.z);
    expect(size.y).toBeGreaterThan(2);

    const runtime = root.userData.sculptRuntime as {
      nodes: { pressPivot: THREE.Object3D };
      sockets: { gripLeft: THREE.Object3D; gripRight: THREE.Object3D };
    };
    expect(runtime.nodes.pressPivot).toBe(pivot);
    expect(runtime.sockets.gripLeft).toBe(left);
    expect(typeof root.userData.tick).toBe("function");
    expect(typeof root.userData.dispose).toBe("function");
    root.userData.dispose();
  });
});
