import { type SignifyClient } from 'signify-ts';
import  { useEffect, useState } from 'react';
import {
  AppBar,
  Paper,
  Toolbar,
  DialogTitle,
  DialogContent,
  Modal,
  DialogActions,
  IconButton,
  Typography,
  Button,
  Dialog,
  List,
  ListItem,
  ListItemText,
  Drawer,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fab,
  Divider, Grid, Stack, Box,
  FormControl, Select, InputLabel, MenuItem
} from '@mui/material';
import { Circle, Delete, Menu } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { appConfig } from './config';
import { useSignifyClient } from './signify/useSignifyClient';
import {
  randomSignifyPasscode,
  toError,
  waitOperation,
  type SignifyStateSummary,
} from './signify/client';



const tableObject:any = {
  v: {
    title: "Version String",
    description: "",
    notes: ""
  },
  i: {
    title: "Identifier Prefix (AID)",
    description: "",
    notes: ""
  },
  s: {
    title: "Sequence Number",
    description: "",
    notes: ""
  },
  et: {
    title: "Message Type",
    description: "",
    notes: ""
  },
  te: {
    title: "Last received Event Message Type in a Key State Notice",
    description: "",
    notes: ""
  },
  d: {
    title: "Event SAID",
    description: "",
    notes: ""
  },
  p: {
    title: "Prior Event SAID",
    description: "",
    notes: ""
  },
  kt: {
    title: "Keys Signing Threshold",
    description: "",
    notes: ""
  },
  k: {
    title: "List of Signing Keys (ordered key set)",
    description: "",
    notes: ""
  },
  nt: {
    title: "Next Keys Signing Threshold",
    description: "",
    notes: ""
  },
  n: {
    title: "List of Next Key Digests (ordered key digest set)",
    description: "",
    notes: ""
  },
  bt: {
    title: "Backer Threshold",
    description: "",
    notes: ""
  },
  b: {
    title: "List of Backers (ordered backer set of AIDs)",
    description: "",
    notes: ""
  },
  br: {
    title: "List of Backers to Remove (ordered backer set of AIDs)",
    description: "",
    notes: ""
  },
  ba: {
    title: "List of Backers to Add (ordered backer set of AIDs)",
    description: "",
    notes: ""
  },
  c: {
    title: "List of Configuration Traits/Modes",
    description: "",
    notes: ""
  },
  a: {
    title: "List of Anchors (seals)",
    description: "",
    notes: ""
  },
  di: {
    title: "Delegator Identifier Prefix (AID)",
    description: "",
    notes: ""
  },
  rd: {
    title: "Merkle Tree Root Digest (SAID)",
    description: "",
    notes: ""
  },
  ee: {
    title: "Last Establishment Event Map",
    description: "",
    notes: ""
  },
  vn: {
    title: "Version Number ('major.minor')",
    description: "",
    notes: ""
  },
  dt: {
    title: "Datetime of the SAID",
    description: "",
    notes: ""
  },
  f: {
    title: "Number of first seen ordinal",
    description: "",
    notes: ""
  }
};

const MainComponent = () => {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // Open drawer by default
  const [url, setUrl] = useState(appConfig.keria.adminUrl);
  const [passcode, setPasscode] = useState('');
  const { connection, client, state, connect } = useSignifyClient();
  const isConnected = connection.status === 'connected';
  const status = connection.status === 'idle'
    ? 'Not Connected'
    : connection.status === 'connecting'
      ? 'Connecting'
      : connection.status === 'connected'
        ? 'Connected'
        : 'Error';

  const toggleDrawer = (open:boolean) => (event:any) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const renderComponent = (componentName: string) => {
    setSelectedComponent(componentName);
  };

  const handleConnect = async () => {
    const connected = await connect({
      adminUrl: url,
      bootUrl: appConfig.keria.bootUrl,
      passcode,
      tier: appConfig.defaultTier,
    });

    if (connected !== null) {
      setSelectedComponent('Identifiers');
      setOpen(false);
    }
  };

  const renderConnectionRequired = () => (
    <Box sx={{ p: 3 }} data-testid="connection-required">
      <Typography>Connect to KERIA before opening this view.</Typography>
    </Box>
  );

  return (
    <div>
      <AppBar position="fixed" sx={{ width: '100%' }}>
        <Toolbar sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <IconButton edge="start" color="inherit" aria-label="menu" data-testid="nav-open" onClick={toggleDrawer(!drawerOpen)}>
            <Menu />
          </IconButton>
          <Typography variant="h6">
            Signify Client
          </Typography>
          <Button color="inherit" sx={{ marginLeft: 'auto' }} onClick={handleClickOpen} data-testid="connect-open">
            <Circle sx={{
              color: isConnected ? 'green' : 'red'
            }} />
            Connect
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer open={drawerOpen} onClose={toggleDrawer(false)}>
        <div
          // width='250px'
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          <List>
            {['Identifiers', 'Credentials', 'Client'].map((text) => (
              <ListItem key={text} onClick={() => renderComponent(text)} data-testid={`nav-${text.toLowerCase()}`}>
                <ListItemText primary={text} />
              </ListItem>
            ))}
          </List>
        </div>
      </Drawer>

      <Dialog open={open} onClose={handleClose} data-testid="connect-dialog">
        <DialogTitle>Connect</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Autocomplete
              id="combo-box-demo"
              options={['https://keria-dev.rootsid.cloud', appConfig.keria.adminUrl]}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                />
              )}
              sx={{ width: 300 }}
              value={url}
              fullWidth
              onChange={(_event, newValue) => {
                setUrl(newValue ?? appConfig.keria.adminUrl);
              }}

            />
            <Stack direction="row" spacing={2}>

              <TextField
                id="outlined-password-input"
                label="Passcode"
                type="text"
                autoComplete="current-password"
                variant="outlined"

                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                helperText="Passcode must be at least 21 characters"
              />
              <Button variant="contained" color="primary" data-testid="generate-passcode" onClick={async () => setPasscode(await randomSignifyPasscode())} sx={{
                padding: '4px',
                height: '40px',
                marginTop: '10px'
              }} >
                Create
              </Button>
            </Stack>

            <Button
              variant="contained"
              color="primary"
              data-testid="connect-submit"
              disabled={connection.status === 'connecting' || passcode.length < 21}
              onClick={handleConnect}
            >
              {connection.status === 'connecting' ? 'Connecting...' : 'Connect'}
            </Button>
            {connection.status === 'error' && (
              <Typography color="error" data-testid="connection-error">
                {connection.error.message}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <Box sx={{ mt: 2 }}>
          <Divider />
        </Box>
        <DialogActions>
          <Grid container spacing={2}>
            <Grid size={12}>
              <Button fullWidth disabled data-testid={`connection-status-${connection.status}`}
                sx={{
                  "&.Mui-disabled": {
                    background: isConnected ? 'green' : 'red',
                    color: "black"
                  }
                }}>
                Status: {status}
              </Button>
            </Grid>

            <Grid size={12}>
              <Button onClick={handleClose} color='primary' fullWidth data-testid="connect-close">
                Close
              </Button>
            </Grid>
          </Grid>
        </DialogActions>
      </Dialog>
      {selectedComponent === 'Identifiers' && (client ? <IdentifierTable client={client} /> : renderConnectionRequired())}

      {selectedComponent === 'Credentials' && <CredentialsComponent />}
      {selectedComponent === 'Client' && (state ? <ClientComponent summary={state} /> : renderConnectionRequired())}
    </div>
  );
};

type IdentifierActionState =
  | { status: 'idle'; message: null; error: null }
  | { status: 'running'; message: string; error: null }
  | { status: 'success'; message: string; error: null }
  | { status: 'error'; message: string; error: Error };

const idleIdentifierAction: IdentifierActionState = {
  status: 'idle',
  message: null,
  error: null,
};

const identifiersFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.aids)) {
    return response.aids;
  }

  return [];
};

const IdentifierTable = ({ client }:{client:SignifyClient}) => {
  const [open, setOpen] = useState(false);
  const [currentIdentifier, setCurrentIdentifier] = useState<any>({});
  const [identifiers, setIdentifiers] = useState<any[]>([])
  const [actionState, setActionState] =
    useState<IdentifierActionState>(idleIdentifierAction);

  const [openCreate, setOpenCreate] = useState(false);
  const [type, setType] = useState('salty');
  const [name, setName] = useState('');
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [dynamicFieldsValues, setDynamicFieldsValues] = useState<any[]>([]);
  const [selectedField, setSelectedField] = useState('');
  const identifierClient = client.identifiers();
  const actionRunning = actionState.status === 'running';
  //async useeffect
  const getIdentifiers = async () => {
    const listIdentifiers = identifiersFromResponse(await identifierClient.list())
    setIdentifiers(listIdentifiers)
    return listIdentifiers;
  }
  useEffect(() => {
    getIdentifiers().catch((error) => {
      const normalized = toError(error);
      setActionState({
        status: 'error',
        message: `Unable to load identifiers: ${normalized.message}. Connect can succeed even when the browser blocks signed KERIA resource requests; check that ${client.url} is reachable from this page and allows the Signify signed-request headers.`,
        error: normalized,
      });
    })
  }, [client])
  const handleOpen = (identifier:any) => {
    setCurrentIdentifier(identifier);
    setOpen(true);
  };

  const handleClickRotate = async (aid: string) => {
    setActionState({
      status: 'running',
      message: `Rotating identifier ${aid}`,
      error: null,
    });

    try {
      const result = await identifierClient.rotate(aid, {})
      const operation = await result.op()
      await waitOperation(client, operation, {
        label: `rotating identifier ${aid}`,
      })
      await getIdentifiers()
      setActionState({
        status: 'success',
        message: `Rotated identifier ${aid}`,
        error: null,
      });
    } catch (error) {
      const normalized = toError(error);
      setActionState({
        status: 'error',
        message: normalized.message,
        error: normalized,
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const body = (
    <Box sx={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 400,
      bgcolor: 'background.paper',
      boxShadow: 24, p: 4,
      overflow: 'auto',
      maxHeight: '80vh',
    }}>
      <h2>Identifier Details</h2>
      <p>Name: {currentIdentifier.name}</p>
      <p>Prefix: {currentIdentifier.prefix}</p>
      <p>Type: {Object.keys(currentIdentifier)[2]}</p>

      {/* {  getTypeDetails(
    Object.keys(currentIdentifier)[2],currentIdentifier[Object.keys(currentIdentifier)[2]]
    )} */}

      <pre>{JSON.stringify(currentIdentifier[Object.keys(currentIdentifier)[2]], null, 2)}</pre>
      <Button
        disabled={actionRunning || !currentIdentifier.name}
        onClick={() => handleClickRotate(currentIdentifier.name)}
      >
        {actionRunning ? 'Working...' : 'Rotate'}
      </Button>
    </Box>
  );

  const handleOpenCreate = () => {
    setOpenCreate(true);
  };

  const handleCloseCreate = () => {
    setOpenCreate(false);
  };

  const handleComplete = async () => {
    let fields:any = {
      algo: type,
    }
    dynamicFields.forEach((field, index) => {
      const value = dynamicFieldsValues[index] ?? '';
      if (field == 'count' || field =='ncount' ){
        fields[field] = parseInt(value);
      }
      else if (field == 'transferable'){
        fields[field] = value == 'true' ? true : false;
      }
      else if (field == 'icodes' || field == 'ncodes' || field == 'prxs' || field == 'nxts'|| field == 'cuts' || field == 'adds'){
        fields[field] = value.split(',');
      }
      else {
      fields[field] = value;
      }
    });
    setActionState({
      status: 'running',
      message: `Creating identifier ${name}`,
      error: null,
    });

    try {
      const result = await identifierClient.create(name, fields)
      const operation = await result.op()
      await waitOperation(client, operation, {
        label: `creating identifier ${name}`,
      })
      await getIdentifiers()
      setActionState({
        status: 'success',
        message: `Created identifier ${name}`,
        error: null,
      });
      setName('');
      setDynamicFields([]);
      setDynamicFieldsValues([]);
      setSelectedField('');
      handleCloseCreate();
    } catch (error) {
      const normalized = toError(error);
      setActionState({
        status: 'error',
        message: normalized.message,
        error: normalized,
      });
    }
  };

  const handleTypeChange = (event:any) => {
    setType(event.target.value);
  };

  const handleFieldChange = (event:any) => {
    const prevFields:any[] = [...dynamicFields];
    //add field to array
    prevFields.push(event.target.value);
    setSelectedField(event.target.value);
    setDynamicFields(prevFields);

    const prevFieldsValues:any[] = [...dynamicFieldsValues];
    //add field to array
    prevFieldsValues.push('');
    setDynamicFieldsValues(prevFieldsValues);


  };

  const handleFieldValueChange = (index:number, event:any) => {
    const prevFieldsValues:any[] = [...dynamicFieldsValues];
    //add field to array
    prevFieldsValues[index] = event.target.value;
    setDynamicFieldsValues(prevFieldsValues);
  }



    const handleNameChange = (event:any) => {
      setName(event.target.value);
    };

    const renderDynamicFields = () => {
      return dynamicFields.map((field, index) => (
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
            placeholder='Enter value'
            fullWidth
            margin="normal"
            variant="outlined"
            value={dynamicFieldsValues[index]}
            onChange={(event) => handleFieldValueChange(index, event)}
          // Add any additional props or logic based on field name if needed
          />
          <br />
          <IconButton
            onClick={() => {
              const prevFields = [...dynamicFields];
              prevFields.splice(index, 1);
              setDynamicFields(prevFields);
              const prevFieldsValues = [...dynamicFieldsValues];
              prevFieldsValues.splice(index, 1);
              setDynamicFieldsValues(prevFieldsValues);
            }}
          >
            <Delete />
          </IconButton>

        </Box>));
    };

    return (
      <>
        {actionState.message && (
          <Box sx={{ p: 2 }}>
            <Typography
              color={actionState.status === 'error' ? 'error' : 'text.primary'}
              data-testid="identifier-action-status"
            >
              {actionState.message}
            </Typography>
          </Box>
        )}
        <TableContainer component={Paper} data-testid="identifier-table">
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Prefix</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {identifiers.map((identifier:any) => (
                <TableRow
                  key={identifier.name}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  onClick={() => handleOpen(identifier)}
                  style={{ cursor: 'pointer' }}
                >
                  <TableCell component="th" scope="row">
                    {identifier.name}
                  </TableCell>
                  <TableCell>{identifier.prefix}</TableCell>
                  <TableCell>{Object.keys(identifier)[2]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Modal
          open={open}
          onClose={handleClose}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          {body}
        </Modal>
        <Modal open={openCreate} onClose={handleCloseCreate}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              bgcolor: 'background.paper',
              boxShadow: 24, p: 4,
            }}
          >
            <FormControl fullWidth margin="normal">
              <Select value={type} onChange={handleTypeChange}>
                <MenuItem value="salty">Salty</MenuItem>
                <MenuItem value="randy">Randy</MenuItem>
                <MenuItem value="group">Group</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Name"
              placeholder='Enter name'
              value={name}
              onChange={handleNameChange}
              fullWidth
              margin="normal"
              variant="outlined"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel id="demo-simple-select-label">Field</InputLabel>
              <Select value={selectedField} onChange={handleFieldChange}>
                <MenuItem value="transferable">transferable</MenuItem>
                <MenuItem value="isith">isith</MenuItem>
                <MenuItem value="nsith">nsith</MenuItem>
                <MenuItem value="wits">wits</MenuItem>
                <MenuItem value="toad">toad</MenuItem>
                <MenuItem value="proxy">proxy</MenuItem>
                <MenuItem value="delpre">delpre</MenuItem>
                <MenuItem value="dcode">dcode</MenuItem>
                <MenuItem value="data">data</MenuItem>
                <MenuItem value="pre">pre</MenuItem>
                <MenuItem value="states">states</MenuItem>
                <MenuItem value="rstates">rstates</MenuItem>
                <MenuItem value="prxs">prxs</MenuItem>
                <MenuItem value="nxts">nxts</MenuItem>
                <MenuItem value="mhab">mhab</MenuItem>
                <MenuItem value="keys">keys</MenuItem>
                <MenuItem value="ndigs">ndigs</MenuItem>
                <MenuItem value="bran">bran</MenuItem>
                <MenuItem value="count">count</MenuItem>
                <MenuItem value="ncount">ncount</MenuItem>
              </Select>
            </FormControl>
            {/* Add more buttons to add other fields as needed */}
            {renderDynamicFields()}
            <Button variant="contained" 
            disabled={actionRunning || name.trim().length === 0}
            onClick= {handleComplete}
            
            >
              {actionRunning ? 'Working...' : 'Complete'}
            </Button>
          </Box>
        </Modal>
        <Fab
          color="primary"
          aria-label="add"
          style={{ position: 'fixed', bottom: '20px', right: '20px' }}
          onClick={handleOpenCreate}
          disabled={actionRunning}
        >
          <AddIcon />
        </Fab>
      </>
    );
  }


  //make it component 
  const CredentialsComponent = () => <div>Credentials Component</div>;
  const AidComponent = ({ data, text }:{data:any, text:string}) => {

    return (<Card sx={{ maxWidth: 545, marginX: 4 }}>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {text}
        </Typography>
        <Divider />
        <Grid container spacing={2}>
          {Object.entries(data).map(([key, value]) =>
            typeof value === 'string' ? (
              <Grid size={12} key={key}>
                <Typography variant="subtitle1" gutterBottom align='left'>
                  <strong>{tableObject[key].title}</strong> {value}
                </Typography>
              </Grid>
            ) : null
          )}
        </Grid>
      </CardContent>
    </Card>)
  }
  const ClientComponent = ({ summary }:{summary:SignifyStateSummary}) => {
    const agent = summary.state.agent ?? {}
    const controller = summary.state.controller.state ?? {}

    return (
        <>
          <Box sx={{ p: 2 }} data-testid="client-summary">
            <Typography data-testid="controller-aid">
              Controller AID: {summary.controllerPre}
            </Typography>
            <Typography data-testid="agent-aid">
              Agent AID: {summary.agentPre}
            </Typography>
          </Box>
          <Grid container>
            <AidComponent data={agent} text={'Agent'} />
            <AidComponent data={controller} text={'Controller'} />
          </Grid>

        </>
    );

  };


  export default MainComponent;
