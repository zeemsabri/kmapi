import { Router } from 'express';
import { fetchICloudContacts, syncToICloud, importContactsToFirebase } from '../controllers/cardDavController';

const router = Router();

router.post('/fetch-icloud-contacts', fetchICloudContacts);
router.post('/sync-to-icloud', syncToICloud);
router.post('/import-contacts', importContactsToFirebase);

export default router;
