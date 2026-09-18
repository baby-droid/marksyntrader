import { FunctionComponent } from 'react';
export type SnackbarType = {
    className?: string;
    message?: string;
    showButtonAction?: boolean;
    showButtonClose?: boolean;
    showIcon?: boolean;
    /** Custom props */
    actionLabel?: string;
    onActionClick?: () => void;
    onCloseClick?: () => void;
    /** Variant props */
    indicator?: "neutral" | "fail";
    type?: "mobile" | "desktop";
    /** Auto-dismiss props */
    autoDismiss?: boolean;
    dismissTimeout?: number;
    /** Internal props */
    id?: string;
};
export declare const Snackbar: FunctionComponent<SnackbarType>;
export { SnackbarController } from './SnackbarController';
export { useSnackbar, showSnackbar, hideSnackbar, } from '../../hooks/useSnackbar';
export default Snackbar;
