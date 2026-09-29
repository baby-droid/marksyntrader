/**
 * Dispatch a browser event from code that may also be called by the
 * interpreter. The interpreter does not expose browser globals such as the
 * unqualified CustomEvent constructor, so event construction belongs here in
 * the host runtime.
 */
export const dispatchBrowserEvent = (name, detail) => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;

    // Some interpreter sandboxes do not expose CustomEvent as a global. Read
    // it from the browser window and keep a document.createEvent fallback for
    // older previews and test environments.
    const EventConstructor = window.CustomEvent;
    if (typeof EventConstructor === 'function') {
        window.dispatchEvent(new EventConstructor(name, { detail }));
        return;
    }

    if (typeof document !== 'undefined' && typeof document.createEvent === 'function') {
        const event = document.createEvent('CustomEvent');
        event.initCustomEvent(name, false, false, detail);
        window.dispatchEvent(event);
    }
};