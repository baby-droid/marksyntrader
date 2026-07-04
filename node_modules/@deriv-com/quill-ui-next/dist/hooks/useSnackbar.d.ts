import { SnackbarType } from '../components/snackbar';
export declare const showSnackbar: (props: Omit<SnackbarType, "className">) => string;
export declare const hideSnackbar: (id: string) => void;
export declare const useSnackbar: () => {
    queue: (SnackbarType & {
        id: string;
    })[];
    showSnackbar: (props: Omit<SnackbarType, "className">) => string;
    hideSnackbar: (id: string) => void;
};
export default useSnackbar;
