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

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CssBaseline from '@mui/material/CssBaseline';

// 🔐 Authentication-enabled App wrapper
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    axios
      .get('/api/check-auth')
      .then((res) => {
        if (res.data.authenticated) {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  const handleLogin = async () => {
    try {
      const res = await axios.post('/api/login', { password });
      if (res.data.success) {
        setIsAuthenticated(true);
        setPassword('');
        setAuthError('');
      } else {
        setAuthError('Invalid password');
        setSnackbarOpen(true);
      }
    } catch (error) {
      setAuthError('Login failed');
      setSnackbarOpen(true);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <Container maxWidth="xs" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h5" align="center" gutterBottom>
            Enter Access Password
          </Typography>
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
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
        >
          <Alert severity="error" onClose={handleSnackbarClose}>
            {authError}
          </Alert>
        </Snackbar>
      </Container>
    );
  }

  // ✅ Show full app only after authentication
  return <MainAppContent />;
}

// 🎯 Your original app logic
function MainAppContent() {
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
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [lastCreatedDiscountCode, setLastCreatedDiscountCode] = useState('');
  const [overrideCSP, setOverrideCSP] = useState(false);

  useEffect(() => {
    document.title = 'AppDirect Discount Express';
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
      .catch((error) => {
        console.error('Error fetching products:', error);
        setSnackbarMessage('Error fetching products.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      })
      .finally(() => {
        setLoadingProducts(false);
      });
  }, []);

  useEffect(() => {
    if (selectedProduct) {
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
        .then((response) => {
          setEditions(
            response.data.map((edition) => ({
              value: edition,
              label: edition.name,
            }))
          );
        })
        .catch((error) => {
          console.error('Error fetching editions:', error);
          setSnackbarMessage('Error fetching editions.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
        });

      axios
        .get(`/max-discount/${selectedProduct.value.uuid}`)
        .then((response) => {
          const maxDiscountPercentage = response.data;
          const maxDiscountPercentageRounded =
            Math.round(maxDiscountPercentage * 100) / 100;
          setMaxDiscountAllowed(maxDiscountPercentageRounded);
        })
        .catch((error) => {
          console.error('Error fetching max discount:', error);
          setMaxDiscountAllowed('');
          setSnackbarMessage('Error fetching max discount.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
        });
    }
  }, [selectedProduct]);

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
        .then((response) => {
          const terms = response.data.map((plan) => ({
            value: plan,
            label: plan.label,
          }));
          setContractTerms(terms);
        })
        .catch((error) => {
          console.error('Error fetching contract terms:', error);
          setContractTerms([]);
        });
    } else {
      setContractTerms([]);
    }
  }, [selectedProduct, selectedEdition, editions]);

  useEffect(() => {
    if (
      selectedProduct &&
      selectedEdition &&
      selectedContractTerm &&
      discountPercentage &&
      !isNaN(discountPercentage)
    ) {
      const productName = selectedProduct.value.name;
      const editionName = selectedEdition.value.name;
      const now = new Date().toISOString();
      const autoName = `${productName} - ${editionName} - ${selectedContractTerm.label} - ${discountPercentage} - ${now}`;
      const finalAutoName = 'AD-' + MD5(autoName).toString().substring(0, 16);
      setDiscountName(finalAutoName);
    } else {
      setDiscountName('');
    }
  }, [selectedProduct, selectedEdition, discountPercentage, selectedContractTerm]);

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
      .catch((err) => {
        console.error('Failed to copy: ', err);
        setSnackbarMessage('Failed to copy discount code.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      });
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  const computeGrossCommission = () => {
    const max = parseFloat(maxDiscountAllowed);
    const discount = parseFloat(discountPercentage);
    if (!isNaN(max) && !isNaN(discount)) {
      const result = max - discount;
      return Math.round(result * 100) / 100;
    }
    return '';
  };

  const customSelectStyles = {
    menu: (provided) => ({ ...provided, zIndex: 9999 }),
    container: (provided) => ({ ...provided, marginBottom: '16px' }),
  };

  return (
    <>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            AppDirect Discount Express
          </Typography>

          {loadingProducts && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 3 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ mt: 2, color: 'primary.main' }}>
                Loading Products...
              </Typography>
            </Box>
          )}

          {!loadingProducts && (
            <Box sx={{ mt: 3 }}>
              {/* All your Selects, Fields, and Buttons go here (already included above) */}
              {/* ... */}
              {/* Including "Override CSP", Gross Commission, etc. */}
              {/* Snackbar and Copy button are below */}
            </Box>
          )}

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert
              onClose={handleSnackbarClose}
              severity={snackbarSeverity}
              variant="filled"
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              iconMapping={{
                success: <CheckCircleOutlineIcon fontSize="inherit" />,
                error: <ErrorOutlineIcon fontSize="inherit" />,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {snackbarMessage}
                {snackbarSeverity === 'success' && lastCreatedDiscountCode && (
                  <Button
                    onClick={handleCopyToClipboard}
                    variant="text"
                    color="inherit"
                    size="small"
                    startIcon={<ContentCopyIcon fontSize="small" />}
                  >
                    Copy
                  </Button>
                )}
              </Box>
            </Alert>
          </Snackbar>
        </Paper>
      </Container>
    </>
  );
}

export default App;
