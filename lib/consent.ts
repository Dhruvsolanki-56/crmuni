export type ContactChannel='email'|'whatsapp';

export function normalizeContactIdentifier(channel:ContactChannel,value:string){
  const cleaned=value.trim();
  if(channel==='email')return cleaned.toLowerCase();
  const digits=cleaned.replace(/\D/g,'');
  return digits.length>=7?digits:'';
}

export async function suppressionIdentifier(channel:ContactChannel,value:string){
  const normalized=normalizeContactIdentifier(channel,value); if(!normalized)return '';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${channel}:${normalized}`));
  return [...new Uint8Array(digest)].map((byte)=>byte.toString(16).padStart(2,'0')).join('');
}
