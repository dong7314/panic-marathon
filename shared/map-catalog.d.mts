export type MapId = "schoolyard";
export type MapTheme = MapId;
export type MapPalette = Readonly<{
  trackA: string;
  trackB: string;
  trackEdge: string;
  trackSpeck: string;
  infieldA: string;
  infieldB: string;
  infieldSpeck: string;
  exteriorA: string;
  exteriorB: string;
  exteriorBase: string;
  exteriorSpeck: string;
  outerLine: string;
  innerLine: string;
  laneLine: string;
  accent: string;
}>;
export type MapDefinition = Readonly<{
  id: MapId;
  name: string;
  tagline: string;
  theme: MapTheme;
  palette: MapPalette;
  pitZones: readonly Readonly<{ x: number; y: number; width: number; height: number }>[];
  jumpPads: readonly Readonly<{ x: number; y: number; width: number; height: number; pushX: number; pushY: number }>[];
  spinners: readonly Readonly<{ x: number; y: number; radius: number; speed: number }>[];
}>;

export const MAP_IDS: readonly MapId[];
export const DEFAULT_MAP_ID: MapId;
export const MAP_DEFINITIONS: Readonly<Record<MapId, MapDefinition>>;
export function getMapDefinition(value?: unknown): MapDefinition;
export function isMapId(value: unknown): value is MapId;
