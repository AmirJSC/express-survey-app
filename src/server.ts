#!/usr/bin/env node
import * as net from "net"
import { Client, clientModel } from "./client.model";

const server = net.createServer((c) => {
   c.on('error', () => {
      console.log('Logging an error');
   })
});

let clients: Client = {}

const surveyResponseModel: {[key: number]: any} = {
1: `Output:\n  Starting the survey\n  type: text\n  value: What is your name?\nInput:`,
2: `Output:\n  type: radio\n  value: what is your gender?\n  options: [Male, Female]\nInput:`,
3: `Output:\n  type: checkbox\n  value: what are your hobbies?\n  options: [Fishing, Cooking, Swimming]\nInput:`
};

const signinPage = `HTTP/1.1 200 OK
Content-Type: text/html

<html><head>
   <h3>Sign in</h3>
   <form action=/signin method="post">
      Username: <input type = "text" name = "username" value = ""><br>
      Password: <input type = "password" name = "password" value = ""><br>
      <input type="submit" value="Log in">
   </form>
</head></html>
`;

const notFoundPage = `HTTP/1.1 404
Content-Type: text/html

<html><head>
<h1>Page not Found</h1>
<p>Please <a href="/signin">sign in</a></p>
</head></html>
`;

server.on('connection', handleConnection);
server.listen(8000, function () {
   console.log('listening...');
});

function handleConnection(client: net.Socket) {
   client.setEncoding('utf8');
   client.on('data', onReceiveData);
   client.once('close', onConnClose);

   function onReceiveData(data: string) {
      const serverResponse = handleHttpMethod(data);
      
      client.write(serverResponse);
      client.end();
   }

   function onConnClose() {
      console.log('connection closed');
   }
}

function handleHttpMethod(data: string) {
   let httpMethod = getHttpMethod(data);
   let url = getUrl(data);

   if(httpMethod === 'GET') {
      return handleGetRequest(url);
   }
   else if (httpMethod === 'POST') {
      return handlePostRequest(url, data);
   }
   else {
      return notFoundPage
   }
}

function getHttpMethod(data: string) {
   return data.split('\n')[0].split(' ')[0];
}

function getUrl(data: string) {
   return data.split('\n')[0].split(' ')[1];
}

function handleGetRequest(url: string) {
   if(url === '/signin' || url === '/homepage' || url === '/') {
      return signinPage;
   }
   else if(url.match(/\/input.*/g)) {
      let userName = url.split('/')[2];
      if(!clients[userName]) {
         return redirect('signin')
      }
      return `HTTP/1.1 200 OK
      Content-Type: text/html

      <html><head>
      <h3>Hi, ${userName}</h3>
      <p>Please answer the questions as truthfully as possible</p>
      <textarea style="width: 500px; height: 500px; padding: 5px; border: 2px solid gray; border-radius: 3px">${clients[userName].output}</textarea><br>
      <form style="margin-top: 10px" action=/input/${userName} method="post">
         Input: <input type = "text" name = "client-input" value = "">
         <input type="submit" value="submit">
      </form>
      </head></html>
      `;
   }
   else {
      return notFoundPage;
   }
}

function handlePostRequest(url: string, data: string)  {
   let clientInput = getClientInput(data);
   if(url === '/signin') {
         clientInput = clientInput.split('&')[0];
         storeClient(clientInput);
         return redirect(`input/${clientInput}`); 
   }
   else if(url.match(/\/input.*/g)) {
      let userName = url.split('/')[2].split('&')[0];
      let client = clients[userName];
      handleSurveyFlow(clientInput, client);
      client.step++;
      return redirect(`input/${userName}`);
   }
   else {
      return notFoundPage;
   }
}

function redirect(slug: string) {
   return `HTTP/1.1 303 See Other
Location: http://localhost:8000/${slug}`;
}

function getClientInput(data: string) {
   let dataArray = data.split('\n');
   let clientInput = dataArray[dataArray.length-1].split('=')[1];
   return removeExcessCharacters(clientInput);
}

function removeExcessCharacters(str: string) {
   const spaceRegex = /\+/g;
   const commaRegex = /\%2C/g;
   const newStr = str.replace(spaceRegex, " ").replace(commaRegex, ",");
   return newStr;
}

function storeClient(userName: string) {
   if(!(userName in clients)) {
      clients[userName] = {step: 1, output: 'Input: ', name: '', gender: '', hobbies: ''};
   } 
}

function handleSurveyFlow (clientInput: string, client: clientModel) {
   switch(client.step) {
      case 1:
         validateFirstInput(clientInput, client);
         break;
      case 2:
         client.name = clientInput;
         client.output += `\n${clientInput}\n${surveyResponseModel[client.step]}`;
         break;
      case 3:
         selectGender(clientInput, client);
         break;
      case 4:
         selectHobbies(clientInput, client);
         break;
   }
}

const validateFirstInput = (clientInput: string, client: clientModel) => {
   if(clientInput.toLowerCase() === 'start survey') {
      client.output += `\n${clientInput}\n${surveyResponseModel[client.step]}`;
   }
   else {
      client.output += `\n${clientInput}\nPlease enter "start survey" to start the survey.\nInput:`;
      client.step--;
   }
}

function selectGender (clientInput: string, client: clientModel) {
   if(clientInput.toLowerCase() === 'male' || clientInput.toLowerCase() === 'female') {
      client.gender = clientInput;
      client.output += `\n${clientInput}\n${surveyResponseModel[client.step]}`;
   }
   else {
      client.output += `\n${clientInput}\nPlease enter from one of the choices.\n${surveyResponseModel[client.step-1]}`;
      client.step--;
   }
}  

function selectHobbies(clientInput: string, client: clientModel) {
   const hobbySelection = ['fishing', 'cooking', 'swimming'];
   let isHobbyValid = clientInput.split(',').every((hobby) => {
       return hobbySelection.includes(hobby.trim().toLowerCase());
   });

   if(isHobbyValid) {
      client.hobbies = clientInput;
      client.output += `\n${clientInput}\nOutput:\nA ${client.gender} ${client.name} who likes ${client.hobbies}.`;
   }
   else {
      client.output += `\n${clientInput}\nPlease enter from one of the choices.\n${surveyResponseModel[client.step!-1]}`;
      client.step!--;
   }
}

