import { useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Algos } from 'signify-ts';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
    defaultIdentifierCreateDraft,
    isIdentifierCreateDraft,
} from './identifierHelpers';
import type { IdentifierCreateDraft } from './identifierTypes';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';

/**
 * Props for the identifier create modal.
 *
 * The modal owns a typed user-intent draft only. KERIA calls and operation
 * waiting remain in `IdentifiersView` and the route/runtime boundary.
 */
export interface IdentifierCreateDialogProps {
    open: boolean;
    actionRunning: boolean;
    onClose: () => void;
    onCreate: (draft: IdentifierCreateDraft) => void;
}

const positiveIntegerOrZero = (value: string): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const normalizedDraft = (
    draft: IdentifierCreateDraft
): IdentifierCreateDraft => ({
    ...draft,
    name: draft.name.trim(),
    isith: draft.isith.trim(),
    nsith: draft.nsith.trim(),
    bran: draft.bran.trim(),
});

/**
 * Typed single-sig identifier create form.
 *
 * The form intentionally exposes common identifier choices instead of raw
 * `CreateIdentiferArgs`. Advanced settings are still typed and map through one
 * adapter before reaching Signify.
 */
export const IdentifierCreateDialog = ({
    open,
    actionRunning,
    onClose,
    onCreate,
}: IdentifierCreateDialogProps) => {
    const [draft, setDraft] = useState<IdentifierCreateDraft>(
        defaultIdentifierCreateDraft
    );
    const createDraft = normalizedDraft(draft);
    const createDisabled =
        actionRunning || !isIdentifierCreateDraft(createDraft);

    const updateDraft = (next: Partial<IdentifierCreateDraft>) => {
        setDraft((current) => ({ ...current, ...next }));
    };

    const handleAlgoChange = (
        event: SelectChangeEvent<IdentifierCreateDraft['algo']>
    ) => {
        const algo = event.target.value as IdentifierCreateDraft['algo'];
        updateDraft({ algo });
    };

    const handleComplete = () => {
        if (isIdentifierCreateDraft(createDraft)) {
            onCreate(createDraft);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            slotProps={{
                paper: {
                    sx: {
                        m: { xs: 2, sm: 4 },
                        width: { xs: 'calc(100% - 32px)', sm: '100%' },
                    },
                },
            }}
        >
            <DialogTitle>Create Identifier</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TextField
                        label="Name"
                        placeholder="Enter name"
                        value={draft.name}
                        onChange={(event) =>
                            updateDraft({ name: event.target.value })
                        }
                        fullWidth
                        margin="normal"
                        variant="outlined"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="identifier-create-algo-label">
                            Key Source
                        </InputLabel>
                        <Select
                            labelId="identifier-create-algo-label"
                            label="Key Source"
                            value={draft.algo}
                            onChange={handleAlgoChange}
                        >
                            <MenuItem value={Algos.salty}>Salty</MenuItem>
                            <MenuItem value={Algos.randy}>Randy</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.witnessMode === 'demo'}
                                onChange={(event) =>
                                    updateDraft({
                                        witnessMode: event.target.checked
                                            ? 'demo'
                                            : 'none',
                                    })
                                }
                            />
                        }
                        label="Use demo witnesses"
                    />
                    <Accordion disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>Advanced Options</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={2}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={draft.transferable}
                                            onChange={(event) =>
                                                updateDraft({
                                                    transferable:
                                                        event.target.checked,
                                                })
                                            }
                                        />
                                    }
                                    label="Transferable"
                                />
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                >
                                    <TextField
                                        label="Signing threshold"
                                        value={draft.isith}
                                        onChange={(event) =>
                                            updateDraft({
                                                isith: event.target.value,
                                            })
                                        }
                                        fullWidth
                                    />
                                    <TextField
                                        label="Next threshold"
                                        value={draft.nsith}
                                        onChange={(event) =>
                                            updateDraft({
                                                nsith: event.target.value,
                                            })
                                        }
                                        fullWidth
                                    />
                                </Stack>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                >
                                    <TextField
                                        label="Key count"
                                        type="number"
                                        value={draft.count}
                                        onChange={(event) =>
                                            updateDraft({
                                                count: positiveIntegerOrZero(
                                                    event.target.value
                                                ),
                                            })
                                        }
                                        fullWidth
                                        slotProps={{
                                            htmlInput: {
                                                min: 1,
                                                step: 1,
                                            },
                                        }}
                                    />
                                    <TextField
                                        label="Next key count"
                                        type="number"
                                        value={draft.ncount}
                                        onChange={(event) =>
                                            updateDraft({
                                                ncount: positiveIntegerOrZero(
                                                    event.target.value
                                                ),
                                            })
                                        }
                                        fullWidth
                                        slotProps={{
                                            htmlInput: {
                                                min: 1,
                                                step: 1,
                                            },
                                        }}
                                    />
                                </Stack>
                                {draft.algo === Algos.salty && (
                                    <TextField
                                        label="Salt / branch"
                                        value={draft.bran}
                                        onChange={(event) =>
                                            updateDraft({
                                                bran: event.target.value,
                                            })
                                        }
                                        fullWidth
                                    />
                                )}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                </Stack>
            </DialogContent>
            <DialogActions
                sx={{
                    flexDirection: { xs: 'column-reverse', sm: 'row' },
                    gap: 1,
                    px: { xs: 2, sm: 3 },
                    py: 2,
                }}
            >
                <Button
                    onClick={onClose}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={createDisabled}
                    onClick={handleComplete}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                >
                    {actionRunning ? 'Working...' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
