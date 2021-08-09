import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { mergeABIs } from 'hardhat-deploy/dist/src/utils';
import { ethers } from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const coinV2ImplDeployResult = await deployments.deploy(
    'CoinBHOV2_Implementation',
    {
      from: deployer,
      args: [],
      contract: 'CoinBHOV2',
    }
  );

  if (!coinV2ImplDeployResult.newlyDeployed) {
    return;
  }

  // Merge ABIs of proxy and CoinBHOV2
  const proxyArtifact = await deployments.get('CoinBHO_Proxy');
  const abi = mergeABIs(
    [
      proxyArtifact.abi,
      coinV2ImplDeployResult.abi.filter(
        (fragment) => fragment.type !== 'constructor'
      ),
    ],
    {
      check: true,
      skipSupportsInterface: true,
    }
  );
  const proxiedArtifact = await deployments.get('CoinBHO');
  await deployments.save('CoinBHO', { ...proxiedArtifact, abi });

  // Upgrade proxy to new implementation
  const implContract = await ethers.getContract('CoinBHOV2_Implementation');
  const txData = await implContract.populateTransaction['initialize_v2']();

  await deployments.execute(
    'CoinBHO',
    { from: deployer },
    'upgradeToAndCall',
    coinV2ImplDeployResult.address,
    txData.data || '0x'
  );
};

func.tags = ['coin-bho-v2', 'main-suite'];

func.dependencies = ['coin-bho'];

export default func;
