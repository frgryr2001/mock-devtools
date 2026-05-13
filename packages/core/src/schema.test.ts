import { describe, expect, it } from 'vitest'
import { listTypeSchemaNames, parseInterfaceSchema } from './schema'

describe('parseInterfaceSchema', () => {
  it('parses the supported TypeScript interface subset', () => {
    const schema = parseInterfaceSchema(`
      interface User {
        id: string
        name?: string
        status: 'active' | 'inactive'
        profile: {
          avatarUrl: string
        }
        roles: string[]
      }
    `)

    expect(schema).toEqual({
      name: 'User',
      fields: [
        { name: 'id', optional: false, kind: 'string' },
        { name: 'name', optional: true, kind: 'string' },
        { name: 'status', optional: false, kind: 'union', values: ['active', 'inactive'] },
        {
          name: 'profile',
          optional: false,
          kind: 'object',
          children: [{ name: 'avatarUrl', optional: false, kind: 'string' }],
        },
        {
          name: 'roles',
          optional: false,
          kind: 'array',
          item: { name: 'rolesItem', optional: false, kind: 'string' },
        },
      ],
    })
  })

  it('parses inline object arrays', () => {
    const schema = parseInterfaceSchema(`
      interface CompanyModel {
        fullName: string;
        attachments: {
          url: string;
          name: string;
        }[];
      }
    `)

    expect(schema.fields).toEqual([
      { name: 'fullName', optional: false, kind: 'string' },
      {
        name: 'attachments',
        optional: false,
        kind: 'array',
        item: {
          name: 'attachmentsItem',
          optional: false,
          kind: 'object',
          children: [
            { name: 'url', optional: false, kind: 'string' },
            { name: 'name', optional: false, kind: 'string' },
          ],
        },
      },
    ])
  })

  it('lists and selects a main model from multiple interfaces and classes', () => {
    const source = `
      import { User360Model } from "@icondo/models/class"
      import { isObject } from "lodash"

      export class CompanyModel {
        fullName: string;
        shortName: string;
        attachments: {
          url: string;
          name: string;
        }[];
      }

      export class PartnerModel extends User360Model {
        company: CompanyModel;
        _companyName: string;
        shortName?: string;
        profile?: {
          jobTitle: string;
          officeNumber: string;
          officeNumberE164: string;
        };

        constructor(data?: Partial<PartnerModel>) {
          super();
          if (isObject(data)) {
            Object.assign(this, data);
          }
        }
      }
    `

    expect(listTypeSchemaNames(source)).toEqual(['CompanyModel', 'PartnerModel'])

    expect(parseInterfaceSchema(source, { schemaName: 'PartnerModel' })).toEqual({
      name: 'PartnerModel',
      fields: [
        {
          name: 'company',
          optional: false,
          kind: 'object',
          children: [
            { name: 'fullName', optional: false, kind: 'string' },
            { name: 'shortName', optional: false, kind: 'string' },
            {
              name: 'attachments',
              optional: false,
              kind: 'array',
              item: {
                name: 'attachmentsItem',
                optional: false,
                kind: 'object',
                children: [
                  { name: 'url', optional: false, kind: 'string' },
                  { name: 'name', optional: false, kind: 'string' },
                ],
              },
            },
          ],
        },
        { name: '_companyName', optional: false, kind: 'string' },
        { name: 'shortName', optional: true, kind: 'string' },
        {
          name: 'profile',
          optional: true,
          kind: 'object',
          children: [
            { name: 'jobTitle', optional: false, kind: 'string' },
            { name: 'officeNumber', optional: false, kind: 'string' },
            { name: 'officeNumberE164', optional: false, kind: 'string' },
          ],
        },
      ],
    })
  })

  it('defaults to the last local model when no main model is selected', () => {
    const schema = parseInterfaceSchema(`
      interface CompanyModel {
        fullName: string
      }

      interface PartnerModel {
        company: CompanyModel
      }
    `)

    expect(schema.name).toBe('PartnerModel')
  })

  it('includes inherited fields when the base class source is available', () => {
    const schema = parseInterfaceSchema(
      `
        export class User360Model {
          id: string;
          email: string;
        }

        export class PartnerModel extends User360Model {
          companyName: string;
        }
      `,
      { schemaName: 'PartnerModel' },
    )

    expect(schema.fields).toEqual([
      { name: 'id', optional: false, kind: 'string' },
      { name: 'email', optional: false, kind: 'string' },
      { name: 'companyName', optional: false, kind: 'string' },
    ])
  })
})
