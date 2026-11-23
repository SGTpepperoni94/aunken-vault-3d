import * as THREE from 'three';

/**
 * Central AssetRegistry routing all procedurally baked textures, sprites, and UI icons.
 * Supports optional drop-in overrides so hand-crafted PNGs can replace baked assets
 * without modifying any rendering code.
 */
class AssetRegistryImpl {
  private textures = new Map<string, THREE.Texture>();
  private dataUrls = new Map<string, string>();
  private overrides = new Map<string, string>();

  registerOverride(key: string, url: string): void {
    this.overrides.set(key, url);
  }

  getTexture(key: string, factory: () => THREE.Texture): THREE.Texture {
    const existing = this.textures.get(key);
    if (existing) return existing;

    const overrideUrl = this.overrides.get(key);
    if (overrideUrl) {
      const tex = new THREE.TextureLoader().load(overrideUrl);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, tex);
      return tex;
    }

    const baked = factory();
    this.textures.set(key, baked);
    return baked;
  }

  getDataUrl(key: string, factory: () => string): string {
    const existing = this.dataUrls.get(key);
    if (existing) return existing;

    const overrideUrl = this.overrides.get(key);
    if (overrideUrl) {
      this.dataUrls.set(key, overrideUrl);
      return overrideUrl;
    }

    const baked = factory();
    this.dataUrls.set(key, baked);
    return baked;
  }

  disposeAllTextures(): void {
    this.textures.forEach((tex) => tex.dispose());
    this.textures.clear();
  }
}

export const AssetRegistry = new AssetRegistryImpl();
