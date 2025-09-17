const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const express = require('express');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv'); // Keep this for local development
const qs = require('querystring');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// This will load environment variables from your local .env file.
// When deployed to App Engine, this line will execute but won't find a .env file,
// so it won't load anything. That's why env_variables in app.yaml are crucial for GCP.
dotenv.config();

// 1. IMPORT GOOGLE CLOUD SECRET MANAGER CLIENT
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const secretManagerClient = new SecretManagerServiceClient();

// 2. DEFINE THE ASYNC SECRET FETCHING FUNCTION
// This function will fetch a secret from GCP Secret Manager
async function getSecret(secretName) {
  const projectId = process.env.GCP_PROJECT_NAME; // App Engine sets this automatically
  if (!projectId) {
    console.error('ERROR: GCP_PROJECT_NAME environment variable is not set. Cannot fetch secrets.');
    throw new Error('GCP_PROJECT_NAME not set. Is this running on GCP?');
  }

  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  try {
    const [version] = await secretManagerClient.accessSecretVersion({ name });
    console.log(`Secret '${secretName}' accessed successfully.`);
    return version.payload.data.toString('utf8');
  } catch (error) {
    console.error(`ERROR: Failed to access secret '${secretName}':`, error.message);
    throw error; // Re-throw to propagate the error and prevent server startup
  }
}

app.use(cookieParser());

const SHARED_PASSWORD = process.env.SHARED_PASSWORD || 'defaultPassword';
const PASSWORD_HASH = crypto.createHash('sha256').update(SHARED_PASSWORD).digest('hex');

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const inputHash = crypto.createHash('sha256').update(password).digest('hex');

  if (inputHash === PASSWORD_HASH) {
    res.cookie('auth', true, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

app.get('/api/check-auth', (req, res) => {
  const isAuthed = req.cookies.auth === 'true';
  res.json({ authenticated: isAuthed });
});






// 3. IMMEDIATELY INVOKED ASYNC FUNCTION EXPRESSION (IIAFE)
// This pattern ensures that asynchronous operations (like fetching secrets)
// are completed before the Express server starts listening for requests.
(async () => {
  try {
    console.log('Loading specific environment variables from Secret Manager...');

    // Fetch CLIENT_ID and CLIENT_SECRET from Secret Manager.
    // These assignments will OVERWRITE any values that dotenv.config() might have loaded locally.
    // IMPORTANT: Replace these placeholder secret names with YOUR ACTUAL SECRET NAMES in GCP Secret Manager.
    const MP_API_CREDS = await getSecret(process.env.GCP_SECRET_NAME);
    process.env.CLIENT_ID = JSON.parse(MP_API_CREDS).clientId
    process.env.CLIENT_SECRET = JSON.parse(MP_API_CREDS).clientSecret;

    // MP_URL and PARTNER (and any other variables) will come from:
    // - Your local .env file when running locally (via dotenv.config())
    // - The env_variables section in your app.yaml when deployed to App Engine.
    console.log(`MP_URL loaded (from .env locally, or app.yaml on GCP): ${process.env.MP_URL}`);
    console.log(`PARTNER loaded (from .env locally, or app.yaml on GCP): ${process.env.PARTNER}`);

    console.log('All required environment variables loaded. Starting server setup...');

    // --- YOUR EXPRESS APP SETUP (MIDDLEWARE AND ROUTES) ---

    // Middleware to parse JSON request bodies (should be near the top)
  //  app.use(express.json());
    // Caching headers middleware
app.use((req, res, next) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});

    // Serve React static files from the 'build' folder
    // IMPORTANT: This path (../frontend/build) works because your 'frontend'
    // and 'backend' folders are siblings in your project structure.
    // This should be AFTER specific API routes if those routes handle root paths.
    // For your setup, putting it here is okay if your React app handles / and other GETs.
    //app.use(express.static(path.join(__dirname, '../frontend/build')));

    const buildPath = path.resolve(__dirname, '../frontend/build');
app.use(express.static(buildPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

    // Catch-all handler: send React's index.html for unmatched routes
    // This allows client-side routing (React Router) to work.
    // This should be the absolute last GET route.
    // app.get('/', (req, res) => {
    //   res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
    // });

    // Add your specific API routes here.
    // Example:
    app.get('/api/data', (req, res) => {
      res.json({ message: 'Hello from your API!' });
    });

    app.get('/my-secure-endpoint', async (req, res) => {
        res.send(`Successful`);
    });

    // Function to get fresh OAuth2 token (now uses process.env vars from Secret Manager/app.yaml)
    async function getAccessToken() {
      const body = {
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID, // Will come from Secret Manager
        client_secret: process.env.CLIENT_SECRET, // Will come from Secret Manager
        scope: 'ROLE_PARTNER'
      };

      try {
        console.log(`Attempting to get token from: ${process.env.MP_URL}`); // Will come from app.yaml
        console.log(`CLIENT_ID length: ${process.env.CLIENT_ID ? process.env.CLIENT_ID.length : 'N/A'}`); // For debugging
        const response = await axios.post(`${process.env.MP_URL}/oauth2/token`, qs.stringify(body), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        console.log('Access token fetched successfully.');
        return response.data.access_token;
      } catch (error) {
        console.error('Error fetching access token (check MP_URL, CLIENT_ID, CLIENT_SECRET, network):', error.response?.data || error.message);
        throw error;
      }
    }

    // API route: fetch products
    /*
    app.get('/products', async (req, res) => {
      console.log('start products API');
      try {
        const token = await getAccessToken();
        const allProducts = [];
        let start = 0;
        const count = 500;

        while (true) {
          console.log(start);
          const url = `${process.env.MP_URL}/api/marketplace/v1/listing?count=${count}&start=${start}`;
          const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const products = response.data;

          if (!products || products.length === 0) {
            break;
          }

      // 🔍 Filter out products where availableToResellers is false
      const filteredProducts = products.filter(
        (product) => product.availableToResellers === true
      );          

          allProducts.push(...filteredProducts);
          start += count;
        }
          console.log('allProducts len: '+allProducts.length);
        console.log('end products API');
        res.json(allProducts);
      } catch (error) {
        console.error('Error fetching paginated products:', error.message);
        res.status(500).send('Error fetching products');
      }
    });
    */
    

app.get('/products', async (req, res) => {
  console.log('start products API');
  try {
    const token = await getAccessToken();
    const batchSize = 7;
    const pageSize = 500; // safer value
    const allProducts = [];
    let nextStart = 0;
    let reachedEnd = false;

    while (!reachedEnd) {
      const batchRequests = [];
        console.log('nextStart: '+nextStart);
      for (let i = 0; i < batchSize; i++) {
        const offset = nextStart + i * pageSize;
        console.log(`Requesting start=${offset}`);
        const url = `${process.env.MP_URL}/api/marketplace/v1/listing?count=${pageSize}&start=${offset}`;
        batchRequests.push(
          axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      }

      const batchResponses = await Promise.allSettled(batchRequests);

      reachedEnd = true; // assume done, unless one response proves otherwise

      for (const res of batchResponses) {
        if (
          res.status === 'fulfilled' &&
          Array.isArray(res.value.data) &&
          res.value.data.length > 0
        ) {
          reachedEnd = false; // found more data
          //const filtered = res.value.data.filter(p => p.availableToResellers === true);
          allProducts.push(...res.value.data);
        }
      }

      nextStart += batchSize * pageSize;
    }

    console.log(`Total products retrieved: ${allProducts.length}`);
    res.json(allProducts);
  } catch (error) {
    console.error('Error fetching paginated products:', error.message);
    res.status(500).send('Error fetching products');
  }
});


    // API route: fetch editions by product ID
    app.get('/editions/:productId', async (req, res) => {
      try {
        const token = await getAccessToken();
        const { productId } = req.params;
        console.log(`Product ID: ${productId}`);
        const response = await axios.get(`${process.env.MP_URL}/api/marketplace/v1/products/${productId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        //  Safely get editions and filter out invisible ones
        const editions = response.data?.pricing?.editions || [];
        const visibleEditions = editions.filter(edition => edition.invisible === false);
        res.json(visibleEditions);        
      } catch (error) {
        console.error(error.message);
        res.status(500).send('Error fetching editions');
      }
    });

// API route: fetch plans by productId and editionId.
app.get('/plans/:productId/:editionId', async (req, res) => {
  try {
    const token = await getAccessToken();
    const { productId, editionId } = req.params;
    console.log(`Fetching plans for Product ID: ${productId}, Edition ID: ${editionId}`);

    const url = `${process.env.MP_URL}/api/marketplace/v1/products/${productId}/editions/${editionId}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

const plans = response.data?.plans || [];

const combinedTerms = plans.map(plan => {
  const frequency = plan.frequency || '';
  const minLength = plan.contract ? plan.contract.minimumServiceLength : 'No Contract';

let frequencyLabel;

switch (frequency) {
  case 'DAILY': {
    frequencyLabel = minLength == 1 ? 'Day' : 'Days';
    break;
  }
  case 'MONTHLY': {
    frequencyLabel = minLength == 1 ? 'Month' : 'Months';
    break;
  }
  case 'QUARTERLY': {
    frequencyLabel = minLength == 1 ? 'Quarter' : 'Quarters';
    break;
  }
  case 'SIX_MONTHS': {
    frequencyLabel = minLength == 1 ? 'Six Month' : 'Six Months';
    break;
  }  
  case 'YEARLY': {
    frequencyLabel = minLength == 1 ? 'Year' : 'Years';
    break;
  }
  case 'TWO_YEARS': {
    frequencyLabel = minLength == 1 ? 'Two Year' : 'Two Years';
    break;
  }
  case 'THREE_YEARS': {
    frequencyLabel = minLength == 1 ? 'Three Year' : 'Three Years';
    break;
  }        
}

const label = (minLength == 'No Contract') ? 'No Contract' : `${minLength} ${frequencyLabel}`.trim();

  return {
    'frequency': `${frequency}`,
    'minimumServiceLength': `${minLength}`,
    'label': label
  }
});

const uniqueTerms = Array.from(
  new Map(combinedTerms.map(item => [item.label, item])).values()
);

res.json(uniqueTerms);
  } catch (error) {
    console.error('Error fetching plans:', error.message);
    res.status(500).send('Error fetching contract terms');
  }
});    

    // API route: fetch max discount allowed for the product
    app.get('/max-discount/:productUuid', async (req, res) => {
      try {
        const token = await getAccessToken();
        const { productUuid } = req.params;
        console.log(`Product UUID: ${productUuid}`);
        console.log(`${process.env.MP_URL}/api/v1/revenueShares?partners=${process.env.PARTNER}&showHistory=FALSE&entityType=PRODUCT&entityId=${productUuid}`);
        const response = await axios.get(`${process.env.MP_URL}/api/v1/revenueShares?partners=${process.env.PARTNER}&showHistory=FALSE&entityType=PRODUCT&entityId=${productUuid}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        console.log(JSON.stringify(response.data));
        const shareRecipients = response.data["content"][0]["shareRecipients"];
        const vendorAmount = shareRecipients.find(r => r.type === "VENDOR")["amount"];
        console.log('vendorAmount: '+vendorAmount);
        const maxDiscount = (1-vendorAmount/100)*0.65;
        console.log('maxDiscount: '+maxDiscount);
        const maxDiscountPercentage = maxDiscount*100;
        console.log('maxDiscountPercentage: '+maxDiscountPercentage);
        res.json(maxDiscountPercentage);
      } catch (error) {
        console.error(error.message);
        res.status(500).send('Error fetching maxing discount');
      }
    });


    // // API route: fetch gross commision for product based on discount percentage
    // app.get('/gross-commission/:productUuid/:discountPercentage', async (req, res) => {
    //   try {
    //     const token = await getAccessToken();
    //     const { productUuid, discountPercentage } = req.params;
    //     console.log(`Product UUID: ${productUuid}`);
    //     console.log(`${process.env.MP_URL}/api/v1/revenueShares?partners=${process.env.PARTNER}&showHistory=FALSE&entityType=PRODUCT&entityId=${productUuid}`);
    //     const response = await axios.get(`${process.env.MP_URL}/api/v1/revenueShares?partners=${process.env.PARTNER}&showHistory=FALSE&entityType=PRODUCT&entityId=${productUuid}`, {
    //       headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    //     });
    //     console.log(JSON.stringify(response.data));
    //     const shareRecipients = response.data["content"][0]["shareRecipients"];
    //     const vendorAmount = shareRecipients.find(r => r.type === "VENDOR")["amount"];
    //     console.log('vendorAmount: '+vendorAmount);
    //     console.log('commision to advisor: '+(1-vendorAmount/100)*0.65);
    //     const grossCommission = (1-vendorAmount/100)*0.65 - discountPercentage/100 ;
    //     console.log('grossCommission: '+grossCommission);
    //     const grossCommissiontPercentage = grossCommission*100;
    //     console.log('grossCommissiontPercentage: '+grossCommissiontPercentage);
    //     res.json(grossCommissiontPercentage);
    //   } catch (error) {
    //     console.error(error.message);
    //     res.status(500).send('Error fetching gross commission');
    //   }
    // });    

    app.post('/createDiscount', async (req, res) => {
      try {    
        const token = await getAccessToken();
          const {
        productId,
        editionId,
        discountCodeName,
        discountPercentage,
        contractTerm
      } = req.body;
      const payload = {
      'applicationId': productId,
      'editionId': editionId,
      'type': 'PERCENTAGE',
      'code': discountCodeName,
      'percentage': discountPercentage,
      'description': `${discountPercentage} % discount`,
      'expirationDate': getExpirationDate(contractTerm),
      'autoApply': false
    };

    console.log('payload: '+JSON.stringify(payload));
    const response = await axios.post(
      `${process.env.MP_URL}/api/channel/v1/discounts`,
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        maxBodyLength: Infinity
      }
    );
        console.log(JSON.stringify(response.data));
        res.json(JSON.stringify(response.data));
      } catch (error) {
        console.error(error.message);
        res.status(500).send('Error fetching maxing discount');
      }
    });

    function getExpirationDate(contractTerm) {
      console.log('contractTerm:: '+JSON.stringify(contractTerm));
      contractTerm.minimumServiceLength = parseInt(contractTerm.minimumServiceLength,10);
            const today = new Date();
      const expirationDate = new Date(today);
      if(contractTerm.frequency == 'MONTHLY') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setMonth(today.getMonth() + contractTerm.minimumServiceLength) 
        }
        else {
        expirationDate.setMonth(today.getMonth() + 1) 
        }
      }
      else if(contractTerm.frequency == 'YEARLY') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setFullYear(today.getFullYear() + contractTerm.minimumServiceLength) ;
        }
        else {
        expirationDate.setMonth(today.getFullYear() + 1) ;
        }
      }
      else if(contractTerm.frequency == 'QUARTERLY') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setMonth(today.setMonth() + contractTerm.minimumServiceLength*3) ;
        }
        else {
        expirationDate.setMonth(today.getFullYear() + 1*3) ;
        }
      }
      else if(contractTerm.frequency == 'SIX_MONTHS') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setMonth(today.setMonth() + contractTerm.minimumServiceLength*6) ;
        }
        else {
        expirationDate.setMonth(today.getFullYear() + 1*6) ;
        }
      }
      else if(contractTerm.frequency == 'TWO_YEARS') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setFullYear(today.getFullYear() + contractTerm.minimumServiceLength*2) ;
        }
        else {
        expirationDate.setMonth(today.getFullYear() + 1*2) ;
        }
      }  
      else if(contractTerm.frequency == 'THREE_YEARS') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setFullYear(today.getFullYear() + contractTerm.minimumServiceLength*3) ;
        }
        else {
        expirationDate.setMonth(today.getFullYear() + 1*3) ;
        }
      } 
      else if(contractTerm.frequency == 'DAILY') {
        if(contractTerm.minimumServiceLength != 'No Contract') {
        expirationDate.setDate(today.getDate() + contractTerm.minimumServiceLength) ;
        }
        else {
        expirationDate.setDate(today.getDate() + 1) ;
        }
      }   
      else {
        expirationDate.setDate(today.getDate() + 1) ;
      }                         
      return expirationDate.getTime();
    }    

    // 4. START THE EXPRESS SERVER ONLY AFTER SECRETS ARE LOADED
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    // If any part of secret loading or initial setup fails, log and exit
    console.error('FATAL ERROR: Application startup failed due to configuration or secret loading issues.');
    console.error(error);
    process.exit(1); // Exit the process, preventing a broken or insecure deployment
  }
})(); // End of the IIAFE