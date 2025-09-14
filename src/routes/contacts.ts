import { and, eq } from 'drizzle-orm'
import express, { type Request, type Response } from 'express'
import { db } from '../db'
import { contacts } from '../db/schema-postgres'
import { authenticateUser } from './assistantConfig'

const router = express.Router()

// Helper functions
function generateVcfContent(contact: {
  name: string
  phoneNumber: string
  email?: string | null
  company?: string | null
}): string {
  let vcfContent = 'BEGIN:VCARD\n'
  vcfContent += 'VERSION:3.0\n'
  vcfContent += `FN:${contact.name}\n`
  vcfContent += `TEL:${contact.phoneNumber}\n`

  if (contact.email) {
    vcfContent += `EMAIL:${contact.email}\n`
  }

  if (contact.company) {
    vcfContent += `ORG:${contact.company}\n`
  }

  vcfContent += 'END:VCARD'

  return vcfContent
}

function sanitizeFilename(filename: string): string {
  // Remove or replace characters that are not safe for filenames
  return filename.replace(/[<>:"/\\|?*]/g, '_').trim()
}

// Set up routes
router.get('/:contactId/vcf', async (req, res) => {
  try {
    const { contactId } = req.params
    const contactIdNum = parseInt(contactId, 10)

    if (Number.isNaN(contactIdNum)) {
      res.status(400).json({ error: 'Invalid contact ID' })
      return
    }

    // Get the contact from the database
    const contact = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactIdNum), eq(contacts.isActive, true)))
      .limit(1)

    if (!contact.length) {
      res.status(404).json({ error: 'Contact not found' })
      return
    }

    const contactData = contact[0]

    // Generate VCF content
    const vcfContent = generateVcfContent(contactData)

    // Set appropriate headers for VCF file
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(contactData.name)}.vcf"`,
    )

    res.send(vcfContent)
  } catch (error) {
    console.error('Error serving VCF file:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get(
  '/:contactId/vcf/saas/:saasUserId',
  authenticateUser,
  async (req, res) => {
    try {
      const saasUserId = req.user?.userId
      const { contactId /* , saasUserId */ } = req.params
      const contactIdNum = parseInt(contactId, 10)

      if (Number.isNaN(contactIdNum)) {
        res.status(400).json({ error: 'Invalid contact ID' })
        return
      }

      if (!saasUserId) {
        res.status(401).json({ error: 'SaaS user ID required' })
        return
      }

      // Get the contact from the database, ensuring it belongs to the SaaS user
      const contact = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, contactIdNum),
            eq(contacts.saasUserId, saasUserId),
            eq(contacts.isActive, true),
          ),
        )
        .limit(1)

      if (!contact.length) {
        res.status(404).json({ error: 'Contact not found' })
        return
      }

      const contactData = contact[0]

      // Generate VCF content
      const vcfContent = generateVcfContent(contactData)

      // Set appropriate headers for VCF file
      res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeFilename(contactData.name)}.vcf"`,
      )

      res.send(vcfContent)
    } catch (error) {
      console.error('Error serving VCF file:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

router.get('/', authenticateUser, async (req, res) => {
  try {
    // TODO: Get saasUserId from authentication middleware
    // For now, we'll expect it as a query parameter or header
    //const saasUserId = req.headers['x-saas-user-id'] as string
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'SaaS user ID required' })
      return
    }

    const userContacts = await db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.saasUserId, saasUserId), eq(contacts.isActive, true)),
      )
      .orderBy(contacts.name)

    res.json({ contacts: userContacts })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authenticateUser, async (req, res) => {
  try {
    // const saasUserId = req.headers['x-saas-user-id'] as string
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'SaaS user ID required' })
      return
    }

    const { name, phoneNumber, email, company } = req.body

    if (!name || !phoneNumber) {
      res.status(400).json({ error: 'Name and phone number are required' })
      return
    }

    const newContact = await db
      .insert(contacts)
      .values({
        saasUserId,
        name,
        phoneNumber,
        email,
        company,
      })
      .returning()

    res.status(201).json({ contact: newContact[0] })
  } catch (error) {
    console.error('Error creating contact:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:contactId', authenticateUser, async (req, res) => {
  try {
    // const saasUserId = req.headers['x-saas-user-id'] as string
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'SaaS user ID required' })
      return
    }

    const { contactId } = req.params
    const contactIdNum = parseInt(contactId, 10)

    if (Number.isNaN(contactIdNum)) {
      res.status(400).json({ error: 'Invalid contact ID' })
      return
    }

    const updateData = req.body

    const updatedContact = await db
      .update(contacts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(
        and(eq(contacts.id, contactIdNum), eq(contacts.saasUserId, saasUserId)),
      )
      .returning()

    if (!updatedContact.length) {
      res.status(404).json({ error: 'Contact not found' })
      return
    }

    res.json({ contact: updatedContact[0] })
  } catch (error) {
    console.error('Error updating contact:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:contactId', authenticateUser, async (req, res) => {
  try {
    // const saasUserId = req.headers['x-saas-user-id'] as string
    const saasUserId = req.user?.userId

    if (!saasUserId) {
      res.status(401).json({ error: 'SaaS user ID required' })
      return
    }

    const { contactId } = req.params
    const contactIdNum = parseInt(contactId, 10)

    if (Number.isNaN(contactIdNum)) {
      res.status(400).json({ error: 'Invalid contact ID' })
      return
    }

    const deletedContact = await db
      .update(contacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(contacts.id, contactIdNum), eq(contacts.saasUserId, saasUserId)),
      )
      .returning()

    if (!deletedContact.length) {
      res.status(404).json({ error: 'Contact not found' })
      return
    }

    res.json({ message: 'Contact deleted successfully' })
  } catch (error) {
    console.error('Error deleting contact:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
