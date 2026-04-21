import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    TextField,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { Algos } from 'signify-ts';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
    IDENTIFIER_CREATE_FIELDS,
    type DynamicIdentifierField,
    type IdentifierCreateField,
} from './identifierTypes';

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
        DynamicIdentifierField[]
    >([]);
    const [selectedField, setSelectedField] = useState<
        IdentifierCreateField | ''
    >('');

    useEffect(() => {
        if (!open) {
            setName('');
            setDynamicFields([]);
            setSelectedField('');
        }
    }, [open]);

    const handleComplete = () => {
        onCreate(name, type, dynamicFields);
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
        setDynamicFields((fields) => [...fields, { field, value: '' }]);
    };

    const handleFieldValueChange = (index: number, value: string) => {
        setDynamicFields((fields) =>
            fields.map((field, fieldIndex) =>
                fieldIndex === index ? { ...field, value } : field
            )
        );
    };

    const removeField = (index: number) => {
        setDynamicFields((fields) =>
            fields.filter((_field, fieldIndex) => fieldIndex !== index)
        );
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400,
                    bgcolor: 'background.paper',
                    boxShadow: 24,
                    p: 4,
                }}
            >
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
                        value={selectedField}
                        onChange={handleFieldChange}
                    >
                        {IDENTIFIER_CREATE_FIELDS.map((field) => (
                            <MenuItem key={field} value={field}>
                                {field}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {dynamicFields.map(({ field, value }, index) => (
                    <Box
                        key={`${field}-${index}`}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            margin: '10px',
                            width: '100%',
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
                                    index,
                                    event.target.value
                                )
                            }
                        />
                        <br />
                        <IconButton onClick={() => removeField(index)}>
                            <Delete />
                        </IconButton>
                    </Box>
                ))}
                <Button
                    variant="contained"
                    disabled={actionRunning || name.trim().length === 0}
                    onClick={handleComplete}
                >
                    {actionRunning ? 'Working...' : 'Complete'}
                </Button>
            </Box>
        </Modal>
    );
};
