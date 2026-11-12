// Only what src/71_render3d.js uses, named one by one so the bundler can drop the rest of three.js.
import {
  ACESFilmicToneMapping, Bone, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, Scene, Skeleton, SkinnedMesh, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';

globalThis.THREE = {
  ACESFilmicToneMapping, Bone, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, Scene, Skeleton, SkinnedMesh, SRGBColorSpace, Vector3, WebGLRenderer,
};
