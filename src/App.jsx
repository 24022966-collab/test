import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, useBox, usePlane, useRaycastVehicle, useCylinder } from '@react-three/cannon';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

// ─── CONTROLS ────────────────────────────────────────────────────────────────
function usePlayerControls() {
  const keys = useRef({ forward: false, backward: false, left: false, right: false, brake: false, reset: false });
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    keys.current.forward  = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  keys.current.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  keys.current.left     = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.right    = true;
      if (e.code === 'Space')  keys.current.brake = true;
      if (e.code === 'KeyR')   keys.current.reset = true;
    };
    const up = (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp')    keys.current.forward  = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown')  keys.current.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft')  keys.current.left     = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.current.right    = false;
      if (e.code === 'Space')  keys.current.brake = false;
      if (e.code === 'KeyR')   keys.current.reset = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return keys;
}

// ─── WHEEL ───────────────────────────────────────────────────────────────────
const Wheel = React.forwardRef(({ radius = 0.25, width = 0.24, leftSide }, ref) => {
  const { scene } = useGLTF('/models/car/default/wheel.glb');
  const copiedScene = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [scene]);

  useCylinder(() => ({
    mass: 1,
    type: 'Kinematic',
    material: 'wheel',
    collisionFilterGroup: 0,
    collisionFilterMask: 0,
    args: [radius, radius, width, 16],
  }), ref);

  return (
    <mesh ref={ref}>
      <primitive object={copiedScene} rotation={[0, 0, leftSide ? -Math.PI / 2 : Math.PI / 2]} />
    </mesh>
  );
});

// ─── CAR ─────────────────────────────────────────────────────────────────────
const Car = () => {
  const controls = usePlayerControls();
  const { camera } = useThree();

  // --- Physics chassis (G10 chuẩn) ---
  const chassisWidth = 0.8;
  const chassisHeight = 0.5;
  const chassisDepth = 2.03;

  const [chassisRef, chassisApi] = useBox(() => ({
    mass: 20,
    position: [0, 0.5, 0],
    args: [chassisWidth, chassisHeight, chassisDepth],
    allowSleep: false,
    linearDamping: 0.3,  // Cản trở tự nhiên khi không ga
    angularDamping: 0.99,
  }));

  // --- Wheel setup (G10 chuẩn) ---
  const wheelRadius = 0.25;
  const wheelHeight  = 0.24;

  const wInfo = useMemo(() => ({
    radius: wheelRadius,
    directionLocal: [0, -1, 0],
    suspensionStiffness: 25,
    suspensionRestLength: 0.1,
    maxSuspensionForce: 100000,
    maxSuspensionTravel: 0.3,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    frictionSlip: 3,
    rollInfluence: 0.5, // Tăng lên để chống bốc đầu (wheelie)
    axleLocal: [-1, 0, 0],
    chassisConnectionPointLocal: [0, 0, 0],
    isFrontWheel: false,
    useCustomSlidingRotationalSpeed: true,
    customSlidingRotationalSpeed: -30,
  }), []);

  const frontOffset = -0.635;
  const backOffset  =  0.475;
  const sideOffset  =  0.55;

  const wheelInfos = useMemo(() => [
    // Bánh trước: frictionSlip thấp hơn để có thể queo được khi chạy nhanh
    { ...wInfo, frictionSlip: 2.5, chassisConnectionPointLocal: [-sideOffset, 0, frontOffset], isFrontWheel: true  },
    { ...wInfo, frictionSlip: 2.5, chassisConnectionPointLocal: [ sideOffset, 0, frontOffset], isFrontWheel: true  },
    // Bánh sau: frictionSlip cao hơn để có sức đẩy
    { ...wInfo, frictionSlip: 3.5, chassisConnectionPointLocal: [-sideOffset, 0, backOffset ], isFrontWheel: false },
    { ...wInfo, frictionSlip: 3.5, chassisConnectionPointLocal: [ sideOffset, 0, backOffset ], isFrontWheel: false },
  ], [wInfo]);

  const wheel0 = useRef(null);
  const wheel1 = useRef(null);
  const wheel2 = useRef(null);
  const wheel3 = useRef(null);

  const [vehicle, vehicleApi] = useRaycastVehicle(() => ({
    chassisBody: chassisRef,
    wheelInfos,
    wheels: [wheel0, wheel1, wheel2, wheel3],
    indexForwardAxis: 2,
    indexRightAxis:   0,
    indexUpAxis:      1,
  }));

  // --- Models ---
  const { scene: chassisScene } = useGLTF('/models/car/default/chassis.glb');
  const { scene: brakeScene   } = useGLTF('/models/car/default/backLightsBrake.glb');
  const { scene: reverseScene } = useGLTF('/models/car/default/backLightsReverse.glb');
  const { scene: antenaScene  } = useGLTF('/models/car/default/antena.glb');

  // --- Steering state ---
  const currentSteering = useRef(0);
  const angVelY = useRef(0); // Lưu angular velocity trục Y để giữ lại khi clamp

  // Subscribe để đọc angular velocity thực từ Cannon
  useEffect(() => {
    const unsub = chassisApi.angularVelocity.subscribe(([x, y, z]) => {
      angVelY.current = y;
    });
    return unsub;
  }, [chassisApi]);

  const smoothRot = useRef(0);

  // --- Camera state ---
  const camPos    = useRef(new THREE.Vector3(0, 5, 10));
  const camTarget = useRef(new THREE.Vector3());

  // --- Mouse camera control ---
  const camAngle = useRef({ x: 0, y: 0.35, dist: 7 });
  useEffect(() => {
    let middleDown = false;
    const onWheel = (e) => {
      camAngle.current.dist = Math.max(3, Math.min(25, camAngle.current.dist + e.deltaY * 0.01));
    };
    const onDown  = (e) => { if (e.button === 1) middleDown = true;  };
    const onUp    = (e) => { if (e.button === 1) middleDown = false; };
    const onMove  = (e) => {
      if (!middleDown) return;
      camAngle.current.x -= e.movementX * 0.005;
      camAngle.current.y  = Math.max(0.05, Math.min(Math.PI / 2.2, camAngle.current.y + e.movementY * 0.005));
    };
    window.addEventListener('wheel',       onWheel);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup',   onUp);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('wheel',       onWheel);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup',   onUp);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // ─── MAIN LOOP ───────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const { forward, backward, left, right, brake, reset } = controls.current;
    const dt = Math.min(delta, 0.05); // clamp delta để tránh spike lag

    // Chống bốc đầu triệt để: chỉ giữ angular velocity trục Y, xoá X và Z
    chassisApi.angularVelocity.set(0, angVelY.current, 0);

    // Reset xe
    if (reset && chassisRef.current) {
      chassisApi.position.set(0, 1, 0);
      chassisApi.velocity.set(0, 0, 0);
      chassisApi.angularVelocity.set(0, 0, 0);
      chassisApi.rotation.set(0, chassisRef.current.rotation.y, 0);
    }

    // G10 chuẩn
    const engineForce  = 60; // Giảm nhẹ để không bốc đầu
    const maxSteer     = Math.PI * 0.35; // Tăng góc lái tối đa lên 63°
    const steerSpeed   = dt * 8;         // Đánh lái nhanh hơn

    // Steering làm mượt
    if (left)       currentSteering.current = Math.min(currentSteering.current + steerSpeed, maxSteer);
    else if (right) currentSteering.current = Math.max(currentSteering.current - steerSpeed, -maxSteer);
    else {
      if (Math.abs(currentSteering.current) < steerSpeed) currentSteering.current = 0;
      else currentSteering.current -= steerSpeed * Math.sign(currentSteering.current);
    }

    vehicleApi.setSteeringValue(currentSteering.current, 0);
    vehicleApi.setSteeringValue(currentSteering.current, 1);

    // Engine
    // Áp dụng lực máy vào cả 4 bánh để phân tải đều, chống bốc đầu
    if (forward) {
      vehicleApi.applyEngineForce( engineForce, 0);
      vehicleApi.applyEngineForce( engineForce, 1);
      vehicleApi.applyEngineForce( engineForce, 2);
      vehicleApi.applyEngineForce( engineForce, 3);
    } else if (backward) {
      vehicleApi.applyEngineForce(-engineForce, 0);
      vehicleApi.applyEngineForce(-engineForce, 1);
      vehicleApi.applyEngineForce(-engineForce, 2);
      vehicleApi.applyEngineForce(-engineForce, 3);
    } else {
      for (let i = 0; i < 4; i++) vehicleApi.applyEngineForce(0, i);
    }

    // Brake (G10: 0.45)
    const brakeForce = brake ? 0.45 : ((!forward && !backward) ? 0.1 : 0);
    for (let i = 0; i < 4; i++) vehicleApi.setBrake(brakeForce, i);

    // ─── CAMERA ──────────────────────────────────────────────────────────
    if (!chassisRef.current) return;

    const carPos = new THREE.Vector3();
    chassisRef.current.getWorldPosition(carPos);
    const rawRot = chassisRef.current.rotation.y;

    // Chỉ làm mượt góc xoay để chống jitter vl lý, KHÔNG lerp vị trí
    let diff = rawRot - smoothRot.current;
    diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    smoothRot.current += diff * (1 - Math.exp(-20 * dt));

    // Camera đặt ngay vào đờng offset từ xe — không có delay
    const { x: ax, y: ay, dist } = camAngle.current;
    const hDist = Math.cos(ay) * dist;
    const offset = new THREE.Vector3(
      Math.sin(ax) * hDist,
      Math.sin(ay) * dist,
      Math.cos(ax) * hDist
    );
    offset.applyEuler(new THREE.Euler(0, smoothRot.current, 0));

    // Gán thẳng, không lerp
    camera.position.copy(carPos).add(offset);
    camera.lookAt(carPos.x, carPos.y + 0.5, carPos.z);
  });

  return (
    <group ref={vehicle}>
      <mesh ref={chassisRef} castShadow>
        <meshStandardMaterial visible={false} />
        <group position={[0, -0.25, 0]} rotation={[0, Math.PI / 2, 0]}>
          <primitive object={chassisScene} />
          <primitive object={antenaScene} />
          <primitive object={brakeScene}   visible={controls.current?.brake}    />
          <primitive object={reverseScene} visible={controls.current?.backward} />
        </group>
      </mesh>

      <Wheel ref={wheel0} radius={wheelRadius} width={wheelHeight} leftSide={true}  />
      <Wheel ref={wheel1} radius={wheelRadius} width={wheelHeight} leftSide={false} />
      <Wheel ref={wheel2} radius={wheelRadius} width={wheelHeight} leftSide={true}  />
      <Wheel ref={wheel3} radius={wheelRadius} width={wheelHeight} leftSide={false} />
    </group>
  );
};

// ─── GROUND ──────────────────────────────────────────────────────────────────
const Ground = () => {
  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0] }));
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#FF7A2F" roughness={1} metalness={0} />
    </mesh>
  );
};

// ─── MAP OBJECT ──────────────────────────────────────────────────────────────
const MapObject = ({ filename, position, args = [2, 2, 2], scale = 1, rotation = [0, 0, 0] }) => {
  const { scene } = useGLTF(`/models/map/${filename}`);
  const [ref] = useBox(() => ({ type: 'Static', position, args, rotation }));
  return <primitive ref={ref} object={scene.clone()} scale={scale} />;
};

// ─── OBSTACLE ────────────────────────────────────────────────────────────────
const Obstacle = ({ position, color, args = [2, 2, 2] }) => {
  const [ref] = useBox(() => ({ type: 'Static', position, args }));
  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
};

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#FF7A2F', margin: 0, padding: 0, overflow: 'hidden' }}>
      <style>{`* { margin:0; padding:0; box-sizing:border-box; } body { overflow:hidden; }`}</style>
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }} style={{ background: '#f0905a' }}>
        {/* Fog để nền đất và bầu trời hòa vào nhau kiểu G10 */}
        <fog attach="fog" args={['#FF7A2F', 40, 200]} />
        
        {/* Ánh sáng ấm mềm — kiểu G10 */}
        <ambientLight intensity={1.2} color="#fff0e0" />
        <directionalLight position={[10, 20, 10]} intensity={1.5} color="#ffe0c0" />
        <directionalLight position={[-10, 10, -10]} intensity={0.5} color="#ffcc88" />
        
        {/* Không có grid — kiểu G10 */}

        <Physics gravity={[0, -3.25, 0]} defaultContactMaterial={{ friction: 0.3, restitution: 0 }}>
          <Car />
          <Ground />

          <MapObject filename="house.glb" position={[10, 0, -20]} scale={1} args={[5, 10, 5]} />

          <Obstacle position={[10,   2,  -20]} color="#ffffff" args={[4,  4, 4]} />
          <Obstacle position={[-10,  2,  -40]} color="#f5f0e8" args={[4,  4, 4]} />
          <Obstacle position={[5,  1.5,  -60]} color="#ffffff" args={[15, 3, 3]} />
          <Obstacle position={[-15,  2,  -80]} color="#f5f0e8" args={[4,  4, 4]} />
          <Obstacle position={[20,   2, -100]} color="#ffffff" args={[4,  4, 4]} />
          <Obstacle position={[0,  1.5, -120]} color="#f5f0e8" args={[10, 3, 3]} />
        </Physics>
      </Canvas>
    </div>
  );
}
