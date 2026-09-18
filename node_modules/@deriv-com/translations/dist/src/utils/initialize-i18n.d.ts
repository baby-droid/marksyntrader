import { InitOptions } from 'i18next';
type TInstanceConfig = {
    useSuspense?: Exclude<InitOptions["react"], undefined>["useSuspense"];
    enableDebug?: InitOptions["debug"];
};
export default function initializeI18n({ cdnUrl, useSuspense, enableDebug, }: {
    cdnUrl: string;
} & TInstanceConfig): import('i18next').i18n;
export {};
