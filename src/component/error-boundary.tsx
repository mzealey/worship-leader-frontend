import { Box, Button, Typography } from '@mui/material';
import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { send_error_report } from '../error-catcher';
import { DEBUG } from '../globals';
import { get_translation } from '../langpack';
import * as Icon from './icons';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        send_error_report('react-error-boundary', error, {
            componentStack: info.componentStack ?? undefined,
        });
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        px: 3,
                        textAlign: 'center',
                        gap: 3,
                    }}
                >
                    <Icon.Logo color="primary" style={{ width: 'auto', height: 64 }} />

                    <Typography variant="h4" component="h1">
                        {get_translation('error-boundary-title')}
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
                        {get_translation('error-boundary-body')}
                    </Typography>

                    {DEBUG && this.state.error ? <Box
                            component="pre"
                            sx={{
                                maxWidth: 600,
                                maxHeight: 200,
                                overflow: 'auto',
                                p: 2,
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'divider',
                                fontSize: '0.75rem',
                                textAlign: 'left',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {this.state.error.message}
                            {this.state.error.stack ? `\n\n${this.state.error.stack}` : null}
                        </Box> : null}

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant="contained" onClick={this.handleRetry}>
                            {get_translation('retry')}
                        </Button>
                        <Button variant="outlined" onClick={this.handleReload}>
                            {get_translation('error-boundary-reload')}
                        </Button>
                    </Box>
                </Box>
            );
        }

        return this.props.children;
    }
}
