targetScope = 'resourceGroup'

@description('Azure region for all Gamsdaq resources.')
param location string = resourceGroup().location

@description('Environment suffix (e.g., dev, staging, prod).')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environmentName string = 'prod'

@description('Base application name.')
param appName string = 'gamsdaq'

@description('Container image to deploy to Azure Container Apps.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Whether to deploy the Container App resource in this pass (set false during initial ACR bootstrap to avoid overwriting an active image).')
param deployContainerApp bool = true

@description('Optional GitHub Copilot SDK authentication token injected securely at runtime.')
@secure()
param githubToken string = ''

var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, appName, environmentName))
var acrName = take('acr${replace(appName, '-', '')}${environmentName}${resourceToken}', 50)
var logAnalyticsName = 'log-${appName}-${environmentName}-${resourceToken}'
var appInsightsNameValue = 'appi-${appName}-${environmentName}-${resourceToken}'
var managedIdentityName = 'id-${appName}-${environmentName}-${resourceToken}'
var containerAppEnvName = 'cae-${appName}-${environmentName}-${resourceToken}'
var containerAppNameValue = 'ca-${appName}-${environmentName}-${take(resourceToken, 6)}'

// Built-in AcrPull role definition ID
var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsNameValue
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

resource userIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: location
}

resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, userIdentity.id, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: userIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

var baseEnv = [
  {
    name: 'ASPNETCORE_URLS'
    value: 'http://+:8080'
  }
  {
    name: 'ASPNETCORE_ENVIRONMENT'
    value: 'Production'
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: appInsights.properties.ConnectionString
  }
]

var tokenEnv = !empty(githubToken) ? [
  {
    name: 'GITHUB_TOKEN'
    secretRef: 'github-token'
  }
] : []

var isAcrImage = startsWith(toLower(containerImage), toLower(acr.properties.loginServer))

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = if (deployContainerApp) {
  name: containerAppNameValue
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: isAcrImage ? [
        {
          server: acr.properties.loginServer
          identity: userIdentity.id
        }
      ] : []
      secrets: !empty(githubToken) ? [
        {
          name: 'github-token'
          value: githubToken
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: concat(baseEnv, tokenEnv)
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 15
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      // Single-leader active replica (minReplicas: 1, maxReplicas: 1) guarantees strong consistency
      // for the in-memory Price-Time Priority order book, virtual wallet balance, and cart contracts.
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
  dependsOn: [
    acrPullRoleAssignment
  ]
}

output appUrl string = deployContainerApp ? 'https://${containerApp!.properties.configuration.ingress.fqdn}' : ''
output acrLoginServer string = acr.properties.loginServer
output containerAppName string = containerAppNameValue
output appInsightsName string = appInsights.name
