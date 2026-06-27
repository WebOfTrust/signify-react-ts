/**
 * Shared credential action submission helpers.
 *
 * Credentials and Dashboard both submit W3C presentation commands through the
 * `/credentials` route action so route parsing stays in one boundary.
 */

const newRequestId = (): string =>
    globalThis.crypto?.randomUUID?.() ??
    `credential-${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface CredentialFormSubmitter {
    submit(
        formData: FormData,
        options: { method: 'post'; action: string }
    ): void;
}

export const submitCredentialAction = (
    fetcher: CredentialFormSubmitter,
    formData: FormData
): void => {
    formData.set('requestId', newRequestId());
    fetcher.submit(formData, { method: 'post', action: '/credentials' });
};
