/**
 * Ambient stubs for jimu-* packages, used ONLY by tsconfig.widget-check.json
 * as a compile sanity net on widget.tsx/setting.tsx after refactors (catches
 * wrong import paths / argument mismatches / stale references to moved
 * symbols). Shapes are approximate — modeled just enough to match how this
 * widget actually uses them, not the real jimu type definitions, which
 * require a real ArcGIS Experience Builder Developer Edition (see
 * docs/adr/0001-scaffold-without-local-dev-edition.md). Not used by
 * Jest/ts-jest, not shipped with the widget.
 *
 * `jimu-core`'s `React` export re-exports real React (for version alignment
 * inside Experience Builder) — stubbed here as the real `@types/react`
 * namespace so hooks, JSX, and React.* type positions (ReactNode,
 * CSSProperties, FormEvent, PointerEvent, ...) all resolve for real instead
 * of collapsing to `any` everywhere.
 */
declare module 'jimu-core' {
  import * as ReactNS from 'react'
  export { ReactNS as React }

  export interface AllWidgetProps<T = any> {
    id: string
    useMapWidgetIds?: string[]
    config: T
    [key: string]: any
  }

  export type ImmutableObject<T> = T & {
    set: <K extends keyof T>(key: K, value: T[K]) => ImmutableObject<T>
  }
}

declare module 'jimu-arcgis' {
  import * as ReactNS from 'react'

  export const JimuMapViewComponent: ReactNS.ComponentType<any>
  export function loadArcGISJSAPIModules(modules: string[]): Promise<any[]>
  export type JimuMapView = any
}

declare module 'jimu-for-builder' {
  export interface AllWidgetSettingProps<T = any> {
    id: string
    useMapWidgetIds?: string[]
    config: T
    onSettingChange: (settingChange: { id: string, useMapWidgetIds?: string[], config?: T, [key: string]: any }) => void
    [key: string]: any
  }
}

declare module 'jimu-ui' {
  import * as ReactNS from 'react'

  export const Switch: ReactNS.ComponentType<any>
  export const Alert: ReactNS.ComponentType<any>
}

declare module 'jimu-ui/advanced/setting-components' {
  import * as ReactNS from 'react'

  export const MapWidgetSelector: ReactNS.ComponentType<any>
  export const SettingSection: ReactNS.ComponentType<any>
  export const SettingRow: ReactNS.ComponentType<any>
}

declare module 'jimu-ui/*'
