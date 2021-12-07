import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, log } = deployments;
  const { deployer, bridgeAdmin } = await getNamedAccounts();
  const deployment = await deployments.get('CoinBHO');
  const serviceFee = ethers.BigNumber.from('1000000000000000');
  const minDeposit = ethers.BigNumber.from('10000000000000000');

  try {
    await deploy('Bridge', {
      from: deployer,
      args: [],
      log: true,
      proxy: {
        proxyContract: 'BridgeProxy',
        execute: {
          init: {
            methodName: 'initialize',
            args: [bridgeAdmin, deployment.address, serviceFee, minDeposit],
          },
        },
      },
    });
  } catch (error: any) {
    if (
      error.code === 'INVALID_ARGUMENT' &&
      error.argument === 'address' &&
      error.value === '0x00'
    ) {
      // Monkey patch around hardhat-deploy throwing this error when upgrading the proxy
      // https://github.com/wighawag/hardhat-deploy/blob/master/src/helpers.ts#L1392
      //
      const implContract = await ethers.getContract('Bridge_Implementation');

      console.log('bridgeAdmin', bridgeAdmin);
      console.log('implContract', implContract.address);

      await deployments.execute(
        'Bridge',
        { from: bridgeAdmin, gasLimit: 1000000 },
        'upgradeTo',
        implContract.address
      );
    }
  }
};

func.tags = ['bridge', 'main-suite'];
func.dependencies = ['coin-bho'];
export default func;
