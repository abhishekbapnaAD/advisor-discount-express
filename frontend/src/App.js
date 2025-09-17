// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import MD5 from 'crypto-js/md5';

import {
  Button,
  TextField,
  Typography,
  Box,
  Container,
  CircularProgress,
  Alert,
  Snackbar,
  Paper,
  InputAdornment,
} from '@mui/material';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CssBaseline from '@mui/material/CssBaseline';

axios.defaults.withCredentials = true;

function App() {

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [products, setProducts] = useState([]);
  const [editions, setEditions] = useState([]);
  const [contractTerms, setContractTerms] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedEdition, setSelectedEdition] = useState(null);
  const [selectedContractTerm, setSelectedContractTerm] = useState(null);
  const [discountName, setDiscountName] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [maxDiscountAllowed, setMaxDiscountAllowed] = useState('');
  const [discountError, setDiscountError] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [lastCreatedDiscountCode, setLastCreatedDiscountCode] = useState('');

  useEffect(() => {
    axios
      .get('/api/check-auth')
      .then((res) => setIsAuthenticated(res.data.authenticated))
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    setLoadingProducts(true);
    axios
      .get('/products')
      .then((response) => {
        setProducts(
          response.data.map((product) => ({
            value: product,
            label: product.name + ' (' + product.id + ')',
          }))
        );
      })
      .catch(() => {
        setSnackbarMessage('Error fetching products.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      })
      .finally(() => setLoadingProducts(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !selectedProduct) {
      setEditions([]);
      setSelectedEdition(null);
      setDiscountPercentage('');
      setMaxDiscountAllowed('');
      setDiscountError('');
      setDiscountName('');
      setContractTerms([]);
      setSelectedContractTerm(null);
      return;
    }

    setEditions([]);
    setSelectedEdition(null);
    setDiscountPercentage('');
    setMaxDiscountAllowed('');
    setDiscountError('');
    setDiscountName('');
    setContractTerms([]);
    setSelectedContractTerm(null);

    axios
      .get(`/editions/${selectedProduct.value.id}`)
      .then((res) => {
        setEditions(res.data.map((edition) => ({
          value: edition,
          label: edition.name,
        })));
      })
      .catch(() => {
        setSnackbarMessage('Error fetching editions.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      });

    axios
      .get(`/max-discount/${selectedProduct.value.uuid}`)
      .then((res) => {
        const rounded = Math.round(res.data * 100) / 100;
        setMaxDiscountAllowed(rounded);
      })
      .catch(() => {
        setSnackbarMessage('Error fetching max discount.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      });
  }, [selectedProduct, isAuthenticated]);

  useEffect(() => {
    if (
      selectedProduct &&
      selectedEdition &&
      editions.some((e) => e.value.id === selectedEdition.value.id)
    ) {
      setSelectedContractTerm(null);
      setContractTerms([]);

      axios
        .get(`/plans/${selectedProduct.value.id}/${selectedEdition.value.id}`)
        .then((res) => {
          setContractTerms(res.data.map((plan) => ({
            value: plan,
            label: plan.label,
          })));
        })
        .catch(() => setContractTerms([]));
    } else {
      setContractTerms([]);
    }
  }, [selectedProduct, selectedEdition, editions, isAuthenticated]);

  useEffect(() => {
    if (
      selectedProduct &&
      selectedEdition &&
      selectedContractTerm &&
      discountPercentage &&
      !isNaN(discountPercentage)
    ) {
      const now = new Date().toISOString();
      const autoName = `${selectedProduct.value.name} - ${selectedEdition.value.name} - ${selectedContractTerm.label} - ${discountPercentage} - ${now}`;
      const finalAutoName = 'TN-' + MD5(autoName).toString().substring(0, 16);
      setDiscountName(finalAutoName);
    } else {
      setDiscountName('');
    }
  }, [selectedProduct, selectedEdition, discountPercentage, selectedContractTerm]);

  const handleLogin = async () => {
    try {
      const res = await axios.post('/api/login', { password });
      if (res.data.success) {
        setIsAuthenticated(true);
        setPassword('');
        setAuthError('');
      } else {
        setAuthError('Invalid password');
        setSnackbarMessage('Invalid password');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch {
      setAuthError('Login failed');
      setSnackbarMessage('Login failed');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleSubmit = () => {
    axios
      .post('/createDiscount', {
        productId: selectedProduct.value.id,
        editionId: selectedEdition.value.id,
        productName: selectedProduct.value.name,
        editionName: selectedEdition.value.name,
        discountCodeName: discountName,
        discountPercentage,
        contractTerm: selectedContractTerm.value,
      })
      .then(() => {
        setLastCreatedDiscountCode(discountName);
        setSnackbarMessage('Discount created successfully - ' + discountName);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);

        setSelectedProduct(null);
        setSelectedEdition(null);
        setContractTerms([]);
        setSelectedContractTerm(null);
        setEditions([]);
        setDiscountName('');
        setDiscountPercentage('');
        setMaxDiscountAllowed('');
        setDiscountError('');
      })
      .catch(() => {
        setSnackbarMessage('Error creating discount. Please try again.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      });
  };

  const handleCopyToClipboard = () => {
    if (!lastCreatedDiscountCode) return;
    navigator.clipboard
      .writeText(lastCreatedDiscountCode)
      .then(() => {
        setSnackbarMessage('Discount code copied to clipboard!');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
      })
      .catch(() => {
        setSnackbarMessage('Failed to copy discount code.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      });
  };

  const handleDiscountChange = (value) => {
    let val = value;
    const max = parseFloat(maxDiscountAllowed);

    if (isNaN(max)) {
      if (Number(val) > 100) val = '100';
      if (Number(val) < 0) val = '0';
      setDiscountPercentage(val);
      setDiscountError('');
      return;
    }

    if (Number(val) > max) {
      setDiscountError(`Discount cannot exceed ${max}%`);
    } else if (Number(val) < 0) {
      val = '0';
      setDiscountError('');
    } else {
      setDiscountError('');
    }

    setDiscountPercentage(val);
  };

  const computeGrossCommission = () => {
    const max = parseFloat(maxDiscountAllowed);
    const discount = parseFloat(discountPercentage);
    if (!isNaN(max) && !isNaN(discount)) {
      return Math.round((max - discount) * 100) / 100;
    }
    return '';
  };

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const customSelectStyles = {
    menu: (provided) => ({ ...provided, zIndex: 9999 }),
    container: (provided) => ({ ...provided, marginBottom: '16px' }),
  };

  if (!isAuthenticated) {
    return (
<Box
  sx={{
    minHeight: '100vh',
    backgroundColor: 'rgba(3,16,84,1)',
    py: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  }}
>
  <Container maxWidth="sm">
    <Paper elevation={3} sx={{ p: 4 }}>

          <Typography variant="h5" align="center" gutterBottom>
            Enter Access Password
          </Typography>

          {authError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {authError}
            </Alert>
          )}

          <TextField
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            margin="normal"
          />

          <Button
            variant="contained"
            color="primary"
            onClick={handleLogin}
            fullWidth
            sx={{ mt: 2 }}
          >
            Enter
          </Button>
        </Paper>
      </Container>
      </Box>
    );
  }

  return (
    <>
      <CssBaseline />
<Box
  sx={{
    minHeight: '100vh',
    backgroundColor: 'rgba(3,16,84,1)',
    py: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  }}
>
  <Container maxWidth="sm">
    <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            AppDirect Advisor Discount Express
          </Typography>

          {lastCreatedDiscountCode && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                border: '1px dashed',
                borderColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f0f7ff',
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                Discount Code: {lastCreatedDiscountCode}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyToClipboard}
              >
                Copy
              </Button>
            </Box>
          )}

          {loadingProducts ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 3 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ mt: 2, color: 'primary.main' }}>
                Loading Products...
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                Product
              </Typography>
              <Select
                options={products}
                onChange={setSelectedProduct}
                placeholder="Select Product"
                isDisabled={loadingProducts}
                value={selectedProduct}
                styles={customSelectStyles}
              />

              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                Edition
              </Typography>
              <Select
                options={editions}
                onChange={setSelectedEdition}
                placeholder="Select Edition"
                isDisabled={!selectedProduct}
                value={selectedEdition}
                styles={customSelectStyles}
              />

              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                Contract Term
              </Typography>
              <Select
                options={contractTerms}
                onChange={setSelectedContractTerm}
                placeholder="Select Contract Term"
                isDisabled={!selectedEdition}
                value={selectedContractTerm}
                styles={customSelectStyles}
              />

              <Box sx={{ mt: 3, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Maximum Allowed Discount (%):{' '}
                  <Typography component="span" variant="body1" sx={{ fontWeight: 'normal' }}>
                    {maxDiscountAllowed !== '' && !isNaN(maxDiscountAllowed)
                      ? `${maxDiscountAllowed}%`
                      : 'N/A'}
                  </Typography>
                </Typography>
              </Box>

              <TextField
                label="Discount to Apply (%)"
                type="number"
                value={discountPercentage}
                onChange={(e) => handleDiscountChange(e.target.value)}
                fullWidth
                margin="normal"
                error={!!discountError}
                helperText={discountError}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  inputProps: {
                    min: 0,
                    max: maxDiscountAllowed || 100,
                    step: 0.01,
                  },
                }}
              />

              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Gross Commission after Discount (%):{' '}
                  <Typography component="span" variant="body1" sx={{ fontWeight: 'normal' }}>
                    {computeGrossCommission() !== '' ? `${computeGrossCommission()}%` : 'N/A'}
                  </Typography>
                </Typography>
              </Box>

              <TextField
                label="Discount Code Name"
                value={discountName}
                disabled
                fullWidth
                margin="normal"
              />

              <Button
                variant="contained"
                color="primary"
                fullWidth
                disabled={
                  !selectedProduct ||
                  !selectedEdition ||
                  !selectedContractTerm ||
                  !discountName ||
                  !discountPercentage ||
                  !!discountError
                }
                onClick={handleSubmit}
                sx={{ mt: 3 }}
              >
                Create Discount
              </Button>
            </Box>
          )}

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={4000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </Paper>
      </Container>
      </Box>
    </>
  );
}

export default App;
