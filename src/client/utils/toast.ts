import { enqueueSnackbar, closeSnackbar } from 'notistack';

export const toast = {
	success: (msg: string) => enqueueSnackbar(msg, { variant: 'success' }),
	error: (msg: string) => enqueueSnackbar(msg, { variant: 'error' }),
	info: (msg: string) => enqueueSnackbar(msg, { variant: 'info' }),
	close: closeSnackbar,
};
