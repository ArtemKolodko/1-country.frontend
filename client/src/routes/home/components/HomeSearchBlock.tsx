import React, { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import debounce from 'lodash.debounce'
import { toast } from 'react-toastify'
import { observer } from 'mobx-react-lite'
import BN from 'bn.js'
import { useSearchParams } from 'react-router-dom'

import { HomeSearchResultItem } from './HomeSearchResultItem'
import { useStores } from '../../../stores'
import config from '../../../../config'

import { Button, LinkWrarpper } from '../../../components/Controls'
import { BaseText } from '../../../components/Text'
import { FlexRow, FlexColumn } from '../../../components/Layout'
import { DomainPrice, DomainRecord, relayApi } from '../../../api'
import TermsCheckbox from '../../../components/term-checkbox/TermCheckbox'
import { nameUtils } from '../../../api/utils'
import { parseTweetId } from '../../../utils/parseTweetId'

const SearchBoxContainer = styled.div`
  width: 80%;
  max-width: 800px;
  margin: 0 auto;
`

export const InputContainer = styled.div<{ valid?: boolean }>`
  position: relative;
  border-radius: 5px;
  box-sizing: border-box;
  border: 2px solid ${(props) => (props.valid ? '#758796' : '#ff8c8c')};
  display: flex;
  align-items: center;
  overflow: hidden;
  width: 100%;
`

export const StyledInput = styled.input`
  border: none;
  font-family: 'NunitoRegular', system-ui;
  font-size: 1rem;
  box-sizing: border-box;
  padding: 0.4em;
  width: 100%;

  &:focus {
    outline: none;
  }

  &::placeholder {
    font-size: 0.7em;
    text-align: center;
  }

  @media (min-width: 640px) {
    &::placeholder {
      font-size: 1em;
    }
  }
`

const regx = /^[a-zA-Z0-9]{1,}((?!-)[a-zA-Z0-9]{0,}|-[a-zA-Z0-9]{1,})+$/
const { tweetId } = parseTweetId(
  'https://twitter.com/harmonyprotocol/status/1621679626610425857?s=20&t=SabcyoqiOYxnokTn5fEacg'
)

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(() => resolve(1), ms))
}

const isValidDomainName = (domainName: string) => {
  return regx.test(domainName)
}

export const HomeSearchBlock: React.FC = observer(() => {
  const [searchParams] = useSearchParams()
  const [domainName, setDomainName] = useState(searchParams.get('domain') || '')
  const [loading, setLoading] = useState(false)
  const [price, setPrice] = useState<DomainPrice | undefined>()

  const [record, setRecord] = useState<DomainRecord | undefined>()
  const [isValid, setIsValid] = useState(true)
  const [isTermsAccepted, setIsTermsAccepted] = useState(false)
  const [recordName, setRecordName] = useState('')
  const toastId = useRef(null)
  const [secret] = useState<string>(Math.random().toString(26).slice(2))
  const [regTxHash, setRegTxHash] = useState<string>('')
  const [web2Acquired, setWeb2Acquired] = useState(false)

  const { rootStore, ratesStore, walletStore } = useStores()

  const client = rootStore.d1dcClient

  const updateSearch = (domainName: string) => {
    const _isValid = isValidDomainName(domainName.toLowerCase())
    setIsValid(_isValid)

    if (_isValid) {
      loadDomainRecord(domainName)
    }
  }

  // setup form from query string
  useEffect(() => {
    if (domainName) {
      updateSearch(domainName)
    }
  }, [])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDomainName(event.target.value)
    updateSearch(event.target.value)
  }

  const loadDomainRecord = useMemo(() => {
    return debounce((_domainName) => {
      if (!client || !_domainName) {
        return
      }

      setLoading(true)

      client
        .getRecord({ name: _domainName })
        .then((r) => {
          setRecord(r)
          setLoading(false)
        })
        .catch((ex) => {
          console.log('### ex', ex)
        })
      client.getPrice({ name: _domainName }).then((p) => {
        setPrice(p)
      })

      setRecordName(_domainName)
    }, 500)
  }, [client])

  const claimWeb2DomainWrapper = async () => {
    setLoading(true)
    try {
      await claimWeb2Domain(regTxHash)
    } catch (ex) {
      console.error(ex)
    } finally {
      setLoading(false)
    }
  }

  const claimWeb2Domain = async (txHash: string) => {
    const { success, responseText } = await relayApi().purchaseDomain({
      domain: `${domainName.toLowerCase()}${config.tld}`,
      txHash,
      address: walletStore.walletAddress,
    })
    if (success) {
      toast.success('Web2 domain acquired')
      setWeb2Acquired(true)
    } else {
      console.log(`failure reason: ${responseText}`)
      toast.error(`Unable to acquire web2 domain. Reason: ${responseText}`)
    }
  }

  const handleRentDomain = async () => {
    if (!record || !isValid) {
      return false
    }

    if (
      domainName.length <= 2 &&
      nameUtils.SPECIAL_NAMES.includes(domainName.toLowerCase())
    ) {
      return toast.error('This domain name is reserved for special purpose')
    }

    toastId.current = toast.loading('Processing transaction')

    if (!domainName) {
      return toast.error('Invalid domain')
    }
    if (!nameUtils.isValidName(domainName)) {
      return toast.error(
        'Domain must be alphanumerical characters or hyphen (-)'
      )
    }

    setLoading(true)

    try {
      if (!walletStore.isConnected) {
        await walletStore.connect()
      }
    } catch (e) {
      console.log('Error', e)
      return
    }

    await client.commit({
      name: domainName.toLowerCase(),
      secret,
      onFailed: () => toast.error('Failed to commit purchase'),
      onSuccess: (tx) => {
        console.log(tx)
        const { transactionHash } = tx
        toast.success(
          <FlexRow>
            <BaseText style={{ marginRight: 8 }}>
              Reserved domain for purchase
            </BaseText>
            <LinkWrarpper
              target="_blank"
              href={client.getExplorerUri(transactionHash)}
            >
              <BaseText>View transaction</BaseText>
            </LinkWrarpper>
          </FlexRow>
        )
      },
    })

    console.log('waiting for 5 seconds...')
    await sleep(5000)

    const tx = await client.rent({
      name: recordName,
      secret,
      url: tweetId.toString(),
      amount: new BN(price.amount).toString(),
      onSuccess: (tx) => {
        setLoading(false)
        const { transactionHash } = tx
        toast.update(toastId.current, {
          render: (
            <FlexRow>
              <BaseText style={{ marginRight: 8 }}>Done!</BaseText>
              <LinkWrarpper
                target="_blank"
                href={client.getExplorerUri(transactionHash)}
              >
                <BaseText>View transaction</BaseText>
              </LinkWrarpper>
            </FlexRow>
          ),
          type: 'success',
          isLoading: false,
          autoClose: 2000,
        })
      },
      onFailed: () => {
        setLoading(false)
        toast.update(toastId.current, {
          render: 'Failed to purchase',
          type: 'error',
          isLoading: false,
          autoClose: 2000,
        })
      },
    })

    const txHash = tx.transactionHash
    setRegTxHash(txHash)
    claimWeb2Domain(txHash)

    await sleep(1500)
    window.location.href = `${config.hostname}/new/${recordName}`
  }

  const isAvailable = record ? !record.renter : true
  return (
    <SearchBoxContainer>
      <FlexColumn
        style={{
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          alignContent: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ width: '14em', flexGrow: 0 }}>
          <img
            style={{ objectFit: 'cover', width: '100%' }}
            src="/images/countryLogo.png"
            alt=".country"
          />
        </div>
        <InputContainer valid={isValid && isAvailable} style={{ flexGrow: 0 }}>
          <StyledInput
            placeholder="Register your .country domain"
            value={domainName}
            onChange={handleSearchChange}
            autoFocus
          />
        </InputContainer>
      </FlexColumn>

      {!isValid && <BaseText>Invalid domain name</BaseText>}
      {!isValid && (
        <BaseText>
          Domain can use a mix of letters (English A-Z), numbers and dash
        </BaseText>
      )}
      {loading && <div>Loading...</div>}
      {isValid && !loading && record && price && (
        <>
          <HomeSearchResultItem
            name={recordName}
            rateONE={ratesStore.ONE_USD}
            price={price.formatted}
            available={!record.renter}
          />
          {/* <TermsCheckbox
            checked={isTermsAccepted}
            onChange={setIsTermsAccepted}
          /> */}
          <Button
            disabled={!isValid || !isAvailable}
            style={{ marginTop: '1em' }}
            onClick={handleRentDomain}
          >
            Register
          </Button>
          {/*{!loading && regTxHash && !web2Acquired && (*/}
          {/*  <Button onClick={claimWeb2DomainWrapper} disabled={loading}>*/}
          {/*    TRY AGAIN*/}
          {/*  </Button>*/}
          {/*)}*/}
        </>
      )}
    </SearchBoxContainer>
  )
})