'use strict';

/*
 * Obtains API Gateway and Cognito parameters from deployed stack resources
 * and saves them as JSON file.
 */

const fs = require('fs');

const provider = serverless.service.provider;
const awsProvider = serverless.getProvider('aws');

const listStackResources = async (resources, nextToken) => {
    resources = resources || [];
    const response = await awsProvider.request('CloudFormation', 'listStackResources', {
        StackName: awsProvider.naming.getStackName(),
        NextToken: nextToken
    });
    resources.push(...response.StackResourceSummaries);

    if (response.NextToken) {
        return listStackResources(resources, response.NextToken);
    }

    return resources;
}

const listApiGateways = async (apis, position) => {
    apis = apis || [];
    const response = await awsProvider.request('APIGateway', 'getRestApis', {
        position: position
    });
    apis.push(...response.items);

    if (response.position) {
        return listApiGateways(apis, response.position);
    }

    return apis;
}

const createConfig = async stackResources => {
    const apis = await listApiGateways();
    return {
        region: provider.region,
        cognito: {
            identityPoolId: getPhysicalId(stackResources, 'SwaggerUIIdentityProvider'),
            userPoolId: getPhysicalId(stackResources, 'UserPool'),
            userPoolWebClientId: getPhysicalId(stackResources, 'SwaggerUIAppClient'),
            oauthDomain: `${getPhysicalId(stackResources, 'UserPoolDomain')}.auth.${provider.region}.amazoncognito.com`,
        },
        apiGateway: {
            apis: apis.map(api => ({
                id: api.id,
                name: api.name,
                description: api.description,
                createdDate: api.createdDate
            })),
            stageName: provider.stage,
        },
    };
};

const getPhysicalId = (stackResources, logicalId) => {
    return stackResources.find(r => r.LogicalResourceId === logicalId).PhysicalResourceId || '';
};

const writeConfigFile = config => {
    fs.writeFileSync('./src/config.json', JSON.stringify(config));
};

listStackResources()
    .then(createConfig)
    .then(writeConfigFile);
