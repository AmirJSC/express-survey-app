export type clientModel =  {
   step: number, 
   output: string, 
   name: string, 
   gender: string, 
   hobbies: string
}

export interface Client {
   [key: string]: clientModel
}