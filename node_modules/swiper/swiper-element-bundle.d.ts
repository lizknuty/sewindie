import type { Swiper as SwiperClass, SwiperOptions } from './core/core.js';
declare global {
    interface Window {
        SwiperElementRegisterParams?: (params: string[]) => void;
    }
}
declare const ClassToExtend: typeof HTMLElement;
declare class SwiperContainer extends ClassToExtend {
    swiper?: SwiperClass;
    swiperParams: SwiperOptions;
    passedParams: Record<string, unknown>;
    injectStyles?: string[];
    injectStylesUrls?: string[];
    slideSlots: number;
    rendered?: boolean;
    nested?: boolean;
    init?: boolean;
    constructor();
    cssStyles(): string;
    cssLinks(): string[];
    calcSlideSlots(): void;
    render(): void;
    initialize(): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    updateSwiperOnPropChange(propName: string, propValue: unknown): void;
    attributeChangedCallback(attr: string, prevValue: string | null, newValue: string | null): void;
    static get observedAttributes(): string[];
}
declare class SwiperSlide extends ClassToExtend {
    lazy?: boolean;
    swiperLoopMoveDOM?: boolean;
    constructor();
    render(): void;
    initialize(): void;
    connectedCallback(): void;
}
declare const register: () => void;
export { SwiperContainer, SwiperSlide, register };
