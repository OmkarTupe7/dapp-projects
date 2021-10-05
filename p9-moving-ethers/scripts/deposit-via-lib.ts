import { utils, providers, Wallet } from "ethers";
import { Bridge } from "arb-ts";
const { parseEther } = utils;

const RINKEBY_RPC = process.env.RINKEBY_RPC as string;
const ARBITRUM_TESTNET_RPC = process.env.ARBITRUM_TESTNET_RPC as string;
const DEVNET_PRIVKEY = process.env.DEVNET_PRIVKEY as string;

/**
 * Set up: instantiate L1 / L2 wallets connected to providers
 */
const l1Provider = new providers.JsonRpcProvider(RINKEBY_RPC);
const l2Provider = new providers.JsonRpcProvider(ARBITRUM_TESTNET_RPC);
const l1Wallet = new Wallet(DEVNET_PRIVKEY, l1Provider);
const l2Wallet = new Wallet(DEVNET_PRIVKEY, l2Provider);

/**
 * Set the amount to be deposited in L2 (in wei)
 */
const ethToL2DepositAmount = parseEther("0.0001");

const main = async () => {
  console.log("Deposit Eth via arb-ts");
  /**
   * Use wallets to create an arb-ts bridge instance
   * We'll use bridge for its convenience methods around depositing ETH to L2
   */
  const bridge = await Bridge.init(l1Wallet, l2Wallet);

  /**
   * First, let's check the l2Wallet initial ETH balance
   */
  const l2WalletInitialEthBalance = await bridge.getL2EthBalance();

  /**
   * Deposit ether from L1 to L2
   * This convenience method automatically queries for the retryable's max submission cost and forwards the appropriate amount to L2
   */
  const depositTx = await bridge.depositETH(ethToL2DepositAmount);
  const rec = await depositTx.wait();
  console.warn("deposit L1 receipt is:", rec.transactionHash);

  /**
   * With the transaction confirmed on L1, we now wait and check for the L2 side (i.e., balance credited to L2) to be confirmed as well.
   * First, we get our txn's sequence number from the event logs (using a handy utility method)
   * This sequence number uniquely identifies our L1-to-L2 message:
   */
  const seqNumArr = await bridge.getInboxSeqNumFromContractTransaction(rec);
  if (seqNumArr === undefined) {
    throw new Error("no seq num");
  }
  console.log("inbox sequence number is found!");
  /**
   * Note that a single txn could (in theory) trigger many l1-to-l2 messages; we know ours only triggered 1 tho.
   */
  const seqNum = seqNumArr[0];

  /**
   * Using the sequence number, we can deterministically predict what its corresponding L2 txn will be
   */
  const l2TxHash = await bridge.calculateL2TransactionHash(seqNum);
  console.log("l2TxHash is: " + l2TxHash);

  /**
   * ... and now we wait. Here we're waiting for the Sequencer to include the L2 message in its off-chain queue. The Sequencer should include it in under 10 minutes.
   */
  console.log("waiting for l2 transaction:");
  const l2TxnRec = await l2Provider.waitForTransaction(
    l2TxHash,
    undefined,
    1000 * 60 * 12
  );
  console.log(`L2 transaction found! ${l2TxnRec.transactionHash}`);

  /**
   * Our L2 balance should now be updated!
   */

  const l2WalletUpdatedEthBalance = await bridge.getL2EthBalance();

  console.log(
    `your L2 balance is updated from ${l2WalletInitialEthBalance.toString()} to ${l2WalletUpdatedEthBalance.toString()}`
  );
};

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
