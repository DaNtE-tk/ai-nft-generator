import { useState, useEffect } from 'react';
import { NFTStorage, File } from 'nft.storage'
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import axios from 'axios';

// Components
import Spinner from 'react-bootstrap/Spinner';
import Navigation from './components/Navigation';
import Footer from './components/Footer';

// ABIs
import NFT from './abis/NFT.json'

// Config
import config from './config.json';

function App() {
  const [provider, setProvider] = useState(null)
  const [account, setAccount] = useState(null)
  const [nft,setNFT] = useState(null)

  const [name,setName] = useState("")
  const [description,setDescription] = useState("")
  const [image,setImage] = useState(null);
  const [url, setURL] = useState(null)
  const [message, setMessage] = useState("")

  const [isWaiting, setIsWaiting] = useState(false)


  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    setProvider(provider)

    const network = await provider.getNetwork()

    const nft = new ethers.Contract(config[network.chainId].nft.address,NFT,provider);
    setNFT(nft)

    const name = await nft.name()
    // console.log("name: ",name)
  }

  const submitHandler = async (e) => {
    e.preventDefault()

    if(name === "" || description === ""){
      window.alert("Please provide a name and description.")
      return
    }

    setIsWaiting(true)

    //calling api to generate a image based on the description.
    const imageData = createImage()

    //uploading image to IPFS (NFT.Storage)
    const url = await uploadImage(imageData)

    //minting NFT
    await mintImage(url)

    console.log("Mint success!");

    setIsWaiting(false)
    setMessage("")
  }

  const createImage = async () => {
    setMessage("Generating image...");

    //url of the model API's
    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2`

    //send the request
    const response = await axios({
      url: URL,
      method:'POST',
      headers:{
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept:'application/json',
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        inputs:description,
        options:{wait_for_model:true},
      }),
      responseType: 'arraybuffer',
    })

    const type = response.headers['content-type']
    const data = response.data;

    const base64data = Buffer.from(data).toString('base64')
    const img = `data:${type};base64,` + base64data  // <--rendering the image on the page
    setImage(img)

    return data
  }

  const uploadImage = async (imageData) =>{
    console.log("Uploading image...")

    //Creating an instance to NFT storage
    const nftstorage = new NFTStorage({ token: process.env.REACT_APP_NFT_STORAGE_API_KEY })

    //send request to store image
    const { ipnft } = await nftstorage.store({
      image: new File([imageData], "image.jpeg",{type:"image/jpeg"}),
      name: name,
      description:description
    })

    //save the url\
    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`
    setURL(url)

    return url
  }

  const mintImage = async (tokenURI) =>{
    setMessage("Waiting for mint...")

    const signer = await provider.getSigner()
    const transaction = await nft.connect(signer).mint(tokenURI,{value: ethers.utils.parseUnits("1","ether")})
    await transaction.wait()
  }

  useEffect(() => {
    loadBlockchainData()
  }, [])

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <div className="form">
        <form onSubmit={submitHandler}>
          <input type="text" placeholder="create a name..." onChange={(e)=>{setName(e.target.value)}}></input>
          <input type="text" placeholder="create a description..." onChange={(e)=>{setDescription(e.target.value)}}></input>
          <input type="submit" value="Create & Mint"></input>
        </form>
        <div className="image">
        {!isWaiting&&image?(
          <img src={image} alt="AI generated image"/>
        ): isWaiting? (
          <div className="image__placeholder">
            <Spinner animation="border" />
            <p>{message}</p>
          </div>
        ):(
          <></>
        )}
        </div>

      </div>
      {!isWaiting&&url&&(
        <div className="meta">
          <p>View&nbsp; <a href={url} target="_blank" rel="noreferrer">Metadata</a></p>
        </div>
      )}
      <Footer/>
    </div>

  );
}

export default App;
