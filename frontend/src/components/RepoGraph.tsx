"use client";

import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { GraphData, GraphNode } from "@/utils/types";

type Position = [number, number, number];

interface RepoGraphProps {
  data: GraphData;
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
  cameraResetToken: number;
}

function createPositions(nodes: GraphNode[], edges: GraphData["edges"]): Map<string, Position> {
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));
  edges.forEach((edge) => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  const visited = new Set<string>();
  const components: string[][] = [];
  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const queue = [node.id];
    const component: string[] = [];
    visited.add(node.id);
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    components.push(component.sort());
  });

  components.sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));
  const positions = new Map<string, Position>();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  components.forEach((component, componentIndex) => {
    const isMainCluster = componentIndex === 0;
    const orbitRadius = isMainCluster ? 0 : Math.min(4.8, 3.05 + componentIndex * 0.36);
    const orbitAngle = componentIndex * goldenAngle + 0.3;
    const anchor: Position = isMainCluster
      ? [0, 0.55, 0]
      : [Math.cos(orbitAngle) * orbitRadius, ((componentIndex % 3) - 1) * 0.45, Math.sin(orbitAngle) * orbitRadius];
    const localRadius = component.length === 1 ? 0 : Math.min(1.85, 0.52 + Math.sqrt(component.length) * 0.56);

    component.forEach((id, index) => {
      const angle = index * goldenAngle + componentIndex * 0.8;
      const height = component.length === 1 ? 0 : Math.sin(angle * 1.7) * Math.min(0.85, localRadius * 0.42);
      positions.set(id, [
        anchor[0] + Math.cos(angle) * localRadius,
        anchor[1] + height,
        anchor[2] + Math.sin(angle) * localRadius,
      ]);
    });
  });

  return positions;
}

function nodeColor(type: GraphNode["type"]): string {
  if (type === "python") return "#ffd166";
  if (type === "tsx") return "#a78bfa";
  if (type === "typescript") return "#55f5ff";
  if (type === "website") return "#55f5ff";
  if (type === "page") return "#a78bfa";
  if (type === "script") return "#ffd166";
  if (type === "stylesheet") return "#fb7185";
  if (type === "technology") return "#86efac";
  if (type === "image") return "#f9a8d4";
  return "#fb7185";
}

function CameraDirector({ focus, resetToken, sceneKey }: { focus: Position | null; resetToken: number; sceneKey: string }) {
  const { camera } = useThree();
  const controls = useRef<any>(null);
  const lastSceneKey = useRef<string | null>(null);

  useEffect(() => {
    if (!controls.current) return;

    const isNewScene = lastSceneKey.current !== sceneKey;
    lastSceneKey.current = sceneKey;
    const target = focus ? new THREE.Vector3(...focus) : new THREE.Vector3(0, 0, 0);
    const direction = target.clone().normalize();
    if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
    const destination = focus
      ? target.clone().add(direction.multiplyScalar(4.8)).add(new THREE.Vector3(1.1, 0.8, 1.1))
      : new THREE.Vector3(0, 1.3, 11.5);

    if (isNewScene && !focus) {
      camera.position.set(0, 6.5, 18);
      controls.current.target.set(0, 0, 0);
    }

    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.current.target);
    gsap.to(camera.position, {
      x: destination.x,
      y: destination.y,
      z: destination.z,
      duration: focus ? 1.25 : 1.45,
      ease: "power3.inOut",
      overwrite: true,
    });
    gsap.to(controls.current.target, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: focus ? 1.05 : 1.25,
      ease: "power3.inOut",
      overwrite: true,
      onUpdate: () => controls.current?.update(),
    });

    return () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(controls.current?.target);
    };
  }, [camera, focus, resetToken, sceneKey]);

  return <OrbitControls ref={controls} autoRotate={!focus} autoRotateSpeed={0.42} enableDamping dampingFactor={0.08} maxDistance={25} minDistance={3.4} />;
}

function Nexus() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.12;
    group.current.rotation.y -= delta * 0.08;
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#d7fbff" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.012, 8, 64]} />
        <meshBasicMaterial color="#55f5ff" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[0.6, 0.3, 0]}>
        <torusGeometry args={[0.42, 0.008, 8, 64]} />
        <meshBasicMaterial color="#9b7bff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function DataPulse({ source, target, phase }: { source: Position; target: Position; phase: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(...source), [source]);
  const end = useMemo(() => new THREE.Vector3(...target), [target]);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!mesh.current) return;
    const progress = (state.clock.elapsedTime * 0.18 + phase) % 1;
    point.lerpVectors(start, end, progress);
    mesh.current.position.copy(point);
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshBasicMaterial color="#c8fbff" transparent opacity={0.9} />
    </mesh>
  );
}

function NodeOrb({ node, position, selected, showLabel, onSelect }: { node: GraphNode; position: Position; selected: boolean; showLabel: boolean; onSelect: (node: GraphNode) => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = nodeColor(node.type);
  const radius = 0.13 + Math.min(0.32, node.size / 90);

  useFrame((state) => {
    if (!mesh.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.1 + position[0]) * 0.045;
    const targetScale = selected ? 1.32 : hovered ? 1.16 : 1;
    mesh.current.scale.lerp(new THREE.Vector3(pulse * targetScale, pulse * targetScale, pulse * targetScale), 0.12);
    mesh.current.rotation.y += selected ? 0.006 : 0.002;
  });

  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onClick={(event) => { event.stopPropagation(); onSelect(node); }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 2.7 : 1.35} roughness={0.24} metalness={0.28} />
      </mesh>
      <mesh scale={selected ? 1.85 : hovered ? 1.5 : 1.25}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.1 : 0.045} />
      </mesh>
      {(showLabel || selected || hovered) && (
        <Html center distanceFactor={9} position={[0, radius + 0.25, 0]}>
          <div className={`pointer-events-none max-w-[190px] truncate rounded-md border px-2 py-1 font-mono text-[10px] shadow-xl backdrop-blur-md ${selected || hovered ? "border-white/20 bg-[#08090d]/90 text-white" : "border-white/[0.08] bg-[#08090d]/65 text-white/55"}`} title={node.label}>
            {node.label}
          </div>
        </Html>
      )}
    </group>
  );
}

function GraphScene({ data, selectedId, onSelect, cameraResetToken }: RepoGraphProps) {
  const positions = useMemo(() => createPositions(data.nodes, data.edges), [data.nodes, data.edges]);
  const selectedPosition = selectedId ? positions.get(selectedId) ?? null : null;
  // Labels are shown on hover/selection; the 2D source index keeps the scene
  // readable even when a repository has a dense central cluster.
  const showLabels = false;

  return (
    <>
      <color attach="background" args={["#08090d"]} />
      <fog attach="fog" args={["#08090d", 10, 26]} />
      <ambientLight intensity={0.3} />
      <pointLight color="#55f5ff" intensity={20} distance={18} position={[0, 4, 4]} />
      <pointLight color="#9b7bff" intensity={13} distance={20} position={[-5, -2, -4]} />
      <Stars depth={36} count={1500} factor={2} fade saturation={0.1} radius={20} speed={0.16} />
      <Nexus />

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.05, 3.065, 128]} />
        <meshBasicMaterial color="#55f5ff" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0.42, 0.15, 0.2]}>
        <ringGeometry args={[4.6, 4.612, 128]} />
        <meshBasicMaterial color="#9b7bff" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

      {data.edges.map((edge, index) => {
        const source = positions.get(edge.source);
        const target = positions.get(edge.target);
        if (!source || !target) return null;
        return (
          <group key={`${edge.source}-${edge.target}`}>
            <Line color="#55f5ff" opacity={0.08} points={[source, target]} transparent lineWidth={4} />
            <Line color="#55f5ff" opacity={0.62} points={[source, target]} transparent lineWidth={0.8} />
            <DataPulse phase={(index * 0.21) % 1} source={source} target={target} />
          </group>
        );
      })}

      {data.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return <NodeOrb key={node.id} node={node} onSelect={onSelect} position={position} selected={node.id === selectedId} showLabel={showLabels} />;
      })}
      <CameraDirector focus={selectedPosition} resetToken={cameraResetToken} sceneKey={`${data.root}:${data.nodes.length}:${data.edges.length}`} />
    </>
  );
}

export function RepoGraph({ data, selectedId, onSelect, cameraResetToken }: RepoGraphProps) {
  return (
    <Canvas camera={{ fov: 48, position: [0, 1.5, 13] }} dpr={[1, 2]} gl={{ antialias: true }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
      <GraphScene cameraResetToken={cameraResetToken} data={data} onSelect={onSelect} selectedId={selectedId} />
    </Canvas>
  );
}
