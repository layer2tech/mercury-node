# mercury-node

The mercury node that powers the front end wallet ui for handling lightning transactions/payments.  The front end can be found [here](https://github.com/layer2tech/mercury-wallet).

## Requirements

mercury-node needs a bitcoin core client running and a electrum client. We use Polar (Lightning Node) instead. Ensure that the [setup file](https://github.com/layer2tech/mercury-node/blob/main/src/LDK/bitcoin_clients/ElectrumClient.mts) matches the connection values in Polar.

| Plugin | Link | Setup file |
| ------ | ------ | -----|
| Polar | [Polar Lightning](https://lightningpolar.com/) | [src/LDK/bitcoin_clients/ElectrumClient.mts](https://github.com/layer2tech/mercury-node/blob/main/src/LDK/bitcoin_clients/ElectrumClient.mts)|


## Important files

| File | Explanation |
| ------ | ------ |
| [src/LDK/init/initialiseLDK.ts](https://github.com/layer2tech/mercury-node/blob/main/src/LDK/init/initialiseLDK.ts) | Builds the node and returns a LightningClient |
| [src/server.ts](https://github.com/layer2tech/mercury-node/blob/main/src/server.ts) | Starts the express server with LightningClient |
| [src/LDK/LightningClient.ts](https://github.com/layer2tech/mercury-node/blob/main/src/LDK/LightningClient.ts) | The class that has access to the running node |
| [src/routes/](https://github.com/layer2tech/mercury-node/tree/main/src/routes) | The express server routes that can be called which run LightningClient methods |
| [src/debug_lightning.ts](https://github.com/layer2tech/mercury-node/blob/main/src/debug_lightning.ts) | A debug file to run commands directly rather than through web api |

## Development

mercury-node requires [Node.js](https://nodejs.org/) to run.

Install the dependencies and devDependencies and start the server.

```sh
cd mercury-node
npm i
npm start
```


[//]: # 

   [dill]: <https://github.com/joemccann/dillinger>
   [git-repo-url]: <https://github.com/joemccann/dillinger.git>
   [john gruber]: <http://daringfireball.net>
   [df1]: <http://daringfireball.net/projects/markdown/>
   [markdown-it]: <https://github.com/markdown-it/markdown-it>
   [Ace Editor]: <http://ace.ajax.org>
   [node.js]: <http://nodejs.org>
   [Twitter Bootstrap]: <http://twitter.github.com/bootstrap/>
   [jQuery]: <http://jquery.com>
   [@tjholowaychuk]: <http://twitter.com/tjholowaychuk>
   [express]: <http://expressjs.com>
   [AngularJS]: <http://angularjs.org>
   [Gulp]: <http://gulpjs.com>
