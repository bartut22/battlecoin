let pending
export function loadArenaFlags() {
  if(pending)return pending
  pending=new Promise((resolve,reject)=>{
    const atlas=new Image()
    atlas.onload=()=>{
      const result={}
      for(const [column,side] of ['UP','DOWN'].entries()) {
        const canvas=document.createElement('canvas');canvas.width=192;canvas.height=256
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false
        ctx.drawImage(atlas,column*atlas.width/2,0,atlas.width/2,atlas.height,0,0,192,256)
        const pixels=ctx.getImageData(0,0,192,256)
        for(let i=0;i<pixels.data.length;i+=4)if(Math.min(pixels.data[i],pixels.data[i+2])-pixels.data[i+1]>35)pixels.data[i+3]=0
        ctx.putImageData(pixels,0,0)
        // Anchor the stone socket to the ground, rather than the sprite's bounds.
        result[side]={canvas,anchorX:side==='UP'?290/768:478/768,anchorY:936/1024}
      }
      resolve(result)
    }
    atlas.onerror=()=>{pending=null;reject(new Error('Unable to load arena flags'))}
    atlas.src='/assets/grounded-flags.png'
  })
  return pending
}
