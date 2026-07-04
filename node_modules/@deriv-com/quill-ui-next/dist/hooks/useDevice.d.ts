type DeviceType = 'mobile' | 'tablet' | 'desktop';
export declare const useDevice: () => {
    device: DeviceType;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isDeviceDetected: boolean;
};
export {};
