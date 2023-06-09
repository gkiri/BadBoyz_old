import {
  ConnectWallet,
  useActiveClaimConditionForWallet,
  useAddress,
  useClaimConditions,
  useClaimedNFTSupply,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  useContract,
  useContractMetadata,
  useUnclaimedNFTSupply,
  Web3Button,
} from '@thirdweb-dev/react';
import { HeadingImage } from './components/HeadingImage';
import myGif from './gif/icecream.gif';
//import myGif from './gif/thor.gif';
import { BigNumber, utils } from 'ethers';
import { useMemo, useState } from 'react';
import { Toast } from './components/Toast';
import { parseIneligibility } from './utils/parseIneligibility';
import { useToast } from './hooks/useToast';
//import presale1CSV from "./presale1.csv";
import { useEffect } from 'react';


const urlParams = new URL(window.location.toString()).searchParams;
const contractAddress = urlParams.get('contractAddress') || '0x3b1Bc8c90244171CB3E7b138085bd5E0FBc33D79';

export default function Home() {
  const contractQuery = useContract(contractAddress);
  const contractMetadata = useContractMetadata(contractQuery.contract);

  const address = useAddress();
  const [quantity, setQuantity] = useState(1);
  const { toast, showToast, hideToast } = useToast();

  //Gkiri
  const [showAddress, setShowAddress] = useState(false);
  const [whitelistStatus, setWhitelistStatus] = useState("");

  async function checkWhitelist() {
    setShowAddress(true);
  
    const response = await fetch('/presale1.csv');
    const data = await response.text();
  
    const rows = data.split('\n');
    const addresses = rows.slice(1).map(row => {
      const columns = row.split(',');
      return {
        address: columns[0].trim(),
        maxClaimable: parseInt(columns[1].trim(), 10)
      };
    });

    console.log('Whitelist addresses:', addresses); // Add this line
    console.log('Connected address:', address); // Add this line

    const whitelistEntry = addresses.find(entry => 
      entry.address.toLowerCase() === (address ? address.toLowerCase() : '')
    );
    
    if (whitelistEntry) {
      alert(`Your address is in the whitelist! Max claimable: ${whitelistEntry.maxClaimable}`);
    } else {
      alert('Your address is not in the whitelist.');
    }
  }  

  const claimConditions = useClaimConditions(contractQuery.contract);

  const activeClaimCondition = useActiveClaimConditionForWallet(
    contractQuery.contract,
    address,
  );
  const claimerProofs = useClaimerProofs(contractQuery.contract, address || '');
  const claimIneligibilityReasons = useClaimIneligibilityReasons(
    contractQuery.contract,
    {
      quantity,
      walletAddress: address || '',
    },
  );
  const unclaimedSupply = useUnclaimedNFTSupply(contractQuery.contract);
  const claimedSupply = useClaimedNFTSupply(contractQuery.contract);

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0)
      .add(BigNumber.from(unclaimedSupply.data || 0))
      .toString();
  }, [claimedSupply.data, unclaimedSupply.data]);

  const priceToMint = useMemo(() => {
    const bnPrice = BigNumber.from(
      activeClaimCondition.data?.currencyMetadata.value || 0,
    );
    return `${utils.formatUnits(
      bnPrice.mul(quantity).toString(),
      activeClaimCondition.data?.currencyMetadata.decimals || 18,
    )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);

  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0,
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0,
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;

    if (snapshotClaimable) {
      if (snapshotClaimable === '0') {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    const maxAvailable = BigNumber.from(unclaimedSupply.data || 0);

    let max;
    if (maxAvailable.lt(bnMaxClaimable)) {
      max = maxAvailable;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000)) {
      return 1_000_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    unclaimedSupply.data,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);

  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0,
          )) ||
        numberClaimed === numberTotal
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
  ]);

  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);

  const isLoading = useMemo(() => {
    return (
      activeClaimCondition.isLoading ||
      unclaimedSupply.isLoading ||
      claimedSupply.isLoading ||
      !contractQuery.contract
    );
  }, [
    activeClaimCondition.isLoading,
    contractQuery.contract,
    claimedSupply.isLoading,
    unclaimedSupply.isLoading,
  ]);

  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading],
  );
  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return 'Sold Out';
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0,
      );
      if (pricePerToken.eq(0)) {
        return 'Mint (Free)';
      }
      //return `Mint (${priceToMint})`;//gkiri orig
      return `Mint`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return 'Checking eligibility...';
    }

    return 'Minting not available';
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    buttonLoading,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);

  const dropNotReady = useMemo(
    () =>
      claimConditions.data?.length === 0 ||
      claimConditions.data?.every((cc) => cc.maxClaimableSupply === '0'),
    [claimConditions.data],
  );

  const dropStartingSoon = useMemo(
    () =>
      (claimConditions.data &&
        claimConditions.data.length > 0 &&
        activeClaimCondition.isError) ||
      (activeClaimCondition.data &&
        activeClaimCondition.data.startTime > new Date()),
    [
      activeClaimCondition.data,
      activeClaimCondition.isError,
      claimConditions.data,
    ],
  );

  if (!contractAddress) {
    return (
      <div className="flex items-center justify-center h-full">
        No contract address provided
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center">
      <div className="flex flex-col items-center py-4 mb-10">{/* Add margin-bottom (mb-10) here */}
        <h2
          style={{ fontFamily: 'Graduate ', fontSize: '5rem'}}
          className="text-2xl font-bold mb-2 pulse-neon"
        >
          BADBOYZ MINT
        </h2>

        <p
          className="text-center max-w-xl font-Graduate pulse-neon"
          style={{ fontFamily: 'Graduate ',fontSize: '2.2rem' }} 
        >
          Heroes x Villains
        </p>

  
      {showAddress && address && (
          <p className="text-center">Connected address: {address}</p>
      )}

      </div>

      <div className="flex gap-4">
              {dropNotReady ? (
                <span className="text-red-500 style={{ fontFamily: 'Dangrek' }}">
                  This drop is not ready to be minted yet. (No claim condition
                  set)
                </span>
              ) : dropStartingSoon ? (
                <span className="text-gray-500 style={{ fontFamily: 'Dangrek' }}">
                  Drop is starting soon. Please check back later.
                </span>
              ) : (

              <div className="flex gap-4">
                <div className="flex h-12 w-48 px-2 border border-gray-800 rounded-lg">
                  <button
                    onClick={() => {
                      const value = quantity - 1;
                      if (value > maxClaimable) {
                        setQuantity(maxClaimable);
                      } else if (value < 1) {
                        setQuantity(1);
                      } else {
                        setQuantity(value);
                      }
                    }}
                    className="flex items-center justify-center h-full px-2 text-2xl text-center text-white rounded-l-md mint-button"
                    disabled={isSoldOut}
                  >
                    -
                  </button>
                  <p className="flex items-center justify-center w-16 h-full font-mono text-center text-white lg:w-32" style={{ fontFamily: 'Dangrek',fontSize: '2rem' }}>
                    {!isLoading && isSoldOut ? 'Sold Out' : quantity}
                  </p>
                  <button
                    onClick={() => {
                      const value = quantity + 1;
                      if (value > maxClaimable) {
                        setQuantity(maxClaimable);
                      } else if (value < 1) {
                        setQuantity(1);
                      } else {
                        setQuantity(value);
                      }
                    }}
                    className="flex items-center justify-center h-full px-2 text-2xl text-center text-white rounded-r-md mint-button"
                    disabled={isSoldOut}
                  >
                    +
                  </button>

                  {priceToMint!=null && !priceToMint.includes("undefined")? (
                    <p className="flex items-center justify-center w-36 h-18 font-mono text-center text-white lg:w-32" style={{ fontFamily: 'Dangrek' ,fontSize: '1.2rem'}}>{priceToMint}</p>
                  ) : (
                    <p className="flex items-center justify-center w-36 h-18 font-mono text-center text-white lg:w-32" style={{ fontFamily: 'Dangrek',fontSize: '1.2rem' }}>
                      {'Loading...'}
                    </p>
                  )}

                </div>
                {address ? (
                  <div className="flex rounded-lg mint-button" style={{ fontFamily: 'Dangrek' ,fontSize: '1.2rem'}}>
                    <Web3Button
                      className="flex rounded-lg mint-button "
                      contractAddress={contractQuery.contract?.getAddress() || ''}
                      action={(cntr) => cntr.erc721.claim(quantity)}
                      isDisabled={!canClaim || buttonLoading}
                      onError={(err) => {
                        console.error(err);
                        console.log({ err });
                        showToast({
                          title: 'Failed to mint drop',
                          description: (err as any).reason || '',
                          status: 'error',
                          duration: 9000,
                          isClosable: true,
                        });
                      }}
                      onSuccess={() => {
                        showToast({
                          title: 'Successfully minted',
                          description: 'The NFT has been transferred to your wallet',
                          status: 'success',
                          duration: 5000,
                          isClosable: true,
                        });
                      }}
                    >
                      {buttonLoading ? (
                        <div role="status">
                          <svg
                            aria-hidden="true"
                            className="w-6 h-6 mr-2 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                            viewBox="0 0 100 101"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                              fill="currentColor"
                            />
                            <path
                              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                              fill="currentFill"
                            />
                          </svg>
                          <span className="sr-only">Loading...</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '1.875rem' }}>{buttonText}</span>
                      )}
                    </Web3Button>
                    </div>
                ) : (
                  <ConnectWallet 
                  className="items-center justify-center h-full text-xl text-center text-white rounded-r-md mint-button"
                  />
                )}
                <Toast toast={toast} onClose={hideToast} />
              </div>
              )}
      </div>

    </div>
  );
}
