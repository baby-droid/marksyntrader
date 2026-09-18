import { ModuleType } from 'i18next';
interface OtaI18nextModule {
    cdnUrl: string;
    type: ModuleType;
}
type ReadCallback = (err: unknown, val: Record<string, unknown>) => void;
export default class OtaI18next implements OtaI18nextModule {
    type: ModuleType;
    cdnUrl: string;
    constructor(cdnUrl: string);
    read(language: string, _namespace: string, callback: ReadCallback): void;
}
export {};
