import * as core from '@actions/core'
import * as github from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces'

type ClientType = ReturnType<typeof github.getOctokit>

interface Input {
  token: string
  projectNumber: number
  node_id: string
  type: string
  title: string
  issue?: WebhookPayload['issue']
  pr?: WebhookPayload["pull_request"]
  login: string
  organization?: string
  user?: string
  fields: { [key: string]: string }
}

export function getInputs(): Input {
  const ret = {} as Input
  ret.token = core.getInput('github-token')
  ret.projectNumber = parseInt(core.getInput('project-number'))
  if (isNaN(ret.projectNumber)) throw `No input 'projectNumber'`
  ret.organization = core.getInput('organization') || github.context.repo.owner
  ret.user = core.getInput('user')
  if (ret.organization) {
    ret.login = ret.organization
  } else if (ret.user) {
    ret.login = ret.user
  } else {
    throw `Missing input 'organization' or 'user'`
  }
  
  if (github.context.payload.issue) {
    ret.issue = github.context.payload.issue
    ret.node_id = ret.issue.node_id
    ret.type = 'issue'
    ret.title = ret.issue.title
  } else if (github.context.payload.pull_request) {
    ret.pr = github.context.payload.pull_request
    ret.node_id = ret.pr.node_id
    ret.type = 'pull request'
    ret.title = ret.pr.title
  } else {
    throw `Missing payload 'pull_request' or 'issue'`
  }

  const fields = core.getInput('fields')
  const fieldsValue = core.getInput('fields-value')
  const fieldsValueArr = fieldsValue.split(',')
  if (fields) {
    ret.fields = fields.split(',').reduce((obj, f, i) => {
      if (fieldsValueArr[i]) {
        obj[f] = fieldsValueArr[i]
      }
      return obj
    }, {})
  }

  console.log(ret)
  return ret
}

const run = async (): Promise<void> => {
  if (!github.context) return core.setFailed('No GitHub context.')
  if (!github.context.payload) return core.setFailed('No event. Make sure this is an issue or pr event.')
  const {
    token,
    projectNumber,
    node_id,
    type,
    title,
    login,
    organization,
    user,
    fields,
  } = getInputs()
  const headers = { 'GraphQL-Features': 'projects_next_graphql', }
  const projectGet = async (projectNumber: number, organization?: string, user?: string): Promise<any> => {
    let query
    if (user) {
      query = `{
        user(login: "${user}") {
          projectNext(number: ${projectNumber}) {
            title,
            id
          }
        }
      }`
    } else if (organization) {
      query = `{
        organization(login: "${organization}") {
          projectNext(number: ${projectNumber}) {
            title,
            id
          }
        }
      }`
    } else {
      core.setFailed('No input \'organization\' or \'user\'')
    }
    const response: any = await octokit.graphql(query)
    return response?.organization?.projectNext || response?.user?.projectNext
  }
  const projectAdd = async (projectId: string, contentId: string): Promise<string> => {
    const result: any = await octokit.graphql({
      query: `mutation {
        addProjectNextItem(
          input: { projectId: "${projectId}", contentId: "${contentId}" }
        ) {
          projectNextItem {
            id
          }
        }
      }`,
      headers
    })
    return result?.addProjectNextItem?.projectNextItem?.id
  }
  const projectFieldsGet = async (projectId: string): Promise<any> => {
    const result: any = await octokit.graphql({
      query: `{
        node(id: "${projectId}") {
          ... on ProjectNext {
            fields(first: 20) {
              nodes {
                id
                name
                settings
              }
            }
          }
        }
      }`,
      headers
    })
    console.log('result', result)
    return result?.node?.fields?.nodes
  }
  const projectFieldUpdate = async (projectId: string, itemId: string, fieldId: string, value: any): Promise<any> => {
    const result: any = await octokit.graphql({
      query: `mutation {
        updateProjectNextItemField(
          input: {projectId: "${projectId}", itemId: "${itemId}", fieldId: "${fieldId}", value: ${JSON.stringify(value)}}
        ) {
          projectNextItem {
            id
          }
        }
      }`,
      headers
    })
    console.log(result, null, 2)
    return result?.updateProjectNextItemField?.projectNextItem?.id
  }

  const octokit: ClientType = github.getOctokit(token)

  core.startGroup(`Get project number \u001b[1m${projectNumber}\u001B[m`)
  const projectNext = await projectGet(projectNumber, organization, user)
  core.info(JSON.stringify(projectNext, null, 2))
  core.endGroup()

  if (!projectNext?.id) {
    core.setFailed(`Project number \u001b[1m${projectNumber}\u001B[m not found for login \u001b[1m${login}\u001B[m.
Check the number of the project and that it is owned by \u001b[1m${login}\u001B[m.
EX: \u001b[1mhttps://github.com/orgs/github/projects/1234\u001B[m has the number \u001b[1m1234\u001B[m.`)
    return
  }

  core.startGroup(`Add ${type} \u001b[1m${title}\u001B[m to project \u001b[1m${projectNext.title}\u001B[m`)
  const itemId = await projectAdd(projectNext.id, node_id)
  core.info(JSON.stringify(itemId, null, 2))
  core.endGroup()

  if (fields) {
    const projectFields = await projectFieldsGet(projectNext.id)
    Object.entries(fields).forEach(([name, value]) => {
      const fieldId = projectFields.find((field) => name === field.name).id
      const updatedFieldId = projectFieldUpdate(projectNext.id, itemId, fieldId, value)
      core.info(JSON.stringify(updatedFieldId, null, 2))
    })
  }

  const link = `https://github.com/${user ? 'users/' + user : 'orgs/' + organization}/projects/${projectNumber}`
  core.info(`✅ Successfully added ${type} \u001b[1m${title}\u001B[m to project \u001b[1m${projectNext.title}\u001B[m.
${link}`)
}

export default run
