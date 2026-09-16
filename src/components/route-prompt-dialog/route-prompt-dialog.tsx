// @ts-nocheck — vendored bot code with known upstream type gaps; see AGENTS.md
import React from 'react';
import { observer } from 'mobx-react-lite';
import { useBlocker } from 'react-router-dom';
import { useStore } from '@/hooks/useStore';
import { Localize, localize } from '@deriv-com/translations';
import Dialog from '../shared_ui/dialog';

const RoutePromptDialog = observer(() => {
    const { ui } = useStore() ?? {
        ui: {
            show_prompt: false,
        },
    };
    const { show_prompt } = ui;

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => show_prompt && currentLocation.pathname !== nextLocation.pathname
    );

    // NOTE: we intentionally do NOT attach a `beforeunload` handler. It made the
    // browser show a native "Reload site?" dialog while the bot was running /
    // buying contracts. In-app navigation is still guarded by the router blocker
    // below, so a running bot won't be silently abandoned when switching tabs.

    return (
        <Dialog
            title={localize('Leaving already?')}
            confirm_button_text={localize("Yes, I'll come back later")}
            cancel_button_text={localize("No, I'll stay")}
            onConfirm={() => {
                blocker?.proceed?.();
            }}
            onCancel={() => {
                blocker?.reset?.();
            }}
            is_visible={blocker.state === 'blocked'}
            has_close_icon={false}
        >
            <Localize i18n_default_text='If you leave, your current contract will be completed, but your bot will stop running immediately.' />
        </Dialog>
    );
});

export default RoutePromptDialog;
