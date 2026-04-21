import { useRef, useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Algos } from 'signify-ts';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
    IDENTIFIER_CREATE_FIELDS,
    type DynamicIdentifierField,
    type IdentifierCreateField,
} from './identifierTypes';

interface DynamicIdentifierFieldRow extends DynamicIdentifierField {
    id: number;
}

/**
 * Props for the identifier create modal.
 *
 * The modal owns form state only. It returns raw field rows to the parent so
 * KERIA calls and operation waiting remain in `IdentifiersView`.
 */
export interface IdentifierCreateDialogProps {
    open: boolean;
    actionRunning: boolean;
    onClose: () => void;
    onCreate: (
        name: string,
        algo: Algos,
        fields: readonly DynamicIdentifierField[]
    ) => void;
}

/**
 * Dynamic identifier create form.
 *
 * This component intentionally mirrors the legacy form instead of redesigning
 * identifier creation. Keep validation and Signify operation handling outside
 * this component unless they are purely presentational.
 */
export const IdentifierCreateDialog = ({
    open,
    actionRunning,
    onClose,
    onCreate,
}: IdentifierCreateDialogProps) => {
    const [type, setType] = useState<Algos>(Algos.salty);
    const [name, setName] = useState('');
    const [dynamicFields, setDynamicFields] = useState<
        DynamicIdentifierFieldRow[]
    >([]);
    const [selectedField, setSelectedField] =
        useState<IdentifierCreateField | null>(null);
    const nextDynamicFieldId = useRef(0);

    const handleComplete = () => {
        onCreate(
            name,
            type,
            dynamicFields.map(({ field, value }) => ({ field, value }))
        );
    };

    const handleTypeChange = (event: SelectChangeEvent<Algos>) => {
        setType(event.target.value as Algos);
    };

    const handleFieldChange = (
        event: SelectChangeEvent<IdentifierCreateField | ''>
    ) => {
        const field = event.target.value;
        if (field === '') {
            return;
        }

        setSelectedField(field);
        setDynamicFields((fields) => [
            ...fields,
            { id: nextDynamicFieldId.current++, field, value: '' },
        ]);
    };

    const handleFieldValueChange = (id: number, value: string) => {
        setDynamicFields((fields) =>
            fields.map((field) =>
                field.id === id ? { ...field, value } : field
            )
        );
    };

    const removeField = (id: number) => {
        setDynamicFields((fields) => fields.filter((field) => field.id !== id));
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
                    <FormControl fullWidth margin="normal">
                        <Select value={type} onChange={handleTypeChange}>
                            <MenuItem value={Algos.salty}>Salty</MenuItem>
                            <MenuItem value={Algos.randy}>Randy</MenuItem>
                            <MenuItem value={Algos.group}>Group</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        label="Name"
                        placeholder="Enter name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        fullWidth
                        margin="normal"
                        variant="outlined"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="identifier-create-field-label">
                            Field
                        </InputLabel>
                        <Select
                            labelId="identifier-create-field-label"
                            value={selectedField ?? ''}
                            onChange={handleFieldChange}
                        >
                            {IDENTIFIER_CREATE_FIELDS.map((field) => (
                                <MenuItem key={field} value={field}>
                                    {field}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {dynamicFields.map(({ id, field, value }) => (
                        <Stack
                            key={id}
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{
                                alignItems: { xs: 'stretch', sm: 'center' },
                            }}
                        >
                            <TextField
                                label={field}
                                placeholder="Enter value"
                                fullWidth
                                margin="normal"
                                variant="outlined"
                                value={value}
                                onChange={(event) =>
                                    handleFieldValueChange(
                                        id,
                                        event.target.value
                                    )
                                }
                            />
                            <IconButton
                                aria-label={`Remove ${field}`}
                                onClick={() => removeField(id)}
                                sx={{
                                    alignSelf: { xs: 'flex-end', sm: 'center' },
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Stack>
                    ))}
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
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={actionRunning || name.trim().length === 0}
                    onClick={handleComplete}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                    {actionRunning ? 'Working...' : 'Complete'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
