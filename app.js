var telegramBot = require('node-telegram-bot-api')
var config = require('./config.json')
var fetch = require('node-fetch')
var Filter = require('bad-words')
var filter = new Filter()
var bot = new telegramBot(config.token,{
  polling: true
})
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)



db.defaults({
    lastProfaneWordsWarning: null,
    users: []
}).write();



bot.on('message', (msg)=>{
  //console.log(msg);
  if(msg.text){
    var isAdmin =false;
    bot.getChatAdministrators(msg.chat.id)
      .then((data)=>{
        for(let i =0; i< data.length; i++){
          if(data[i].user.id == msg.from.id){
              isAdmin =true;
          }
        }
        if(!isAdmin &&typeof filter.isProfane(msg.text) == 'string'){
          bot.deleteMessage(msg.chat.id, msg.message_id)
            .then(()=>{
              if(msg.from.username)
                bot.sendMessage(msg.chat.id, 'Profane words are not allowed, @' + msg.from.username)
              else if(msg.from.last_name)
                bot.sendMessage(ctx.chat.id, 'Profane words are not allowed,' + msg.from.first_name+ ''+ msg.from.last_name)
              else
                bot.sendMessage(msg.chat.id, 'Profane words are not allowed, ' + msg.from.first_name)
            })

        }
      })
  }
})


bot.on('new_chat_members', (msg)=>{
  for(let i=0; i<msg.new_chat_members.length; i++){
    if(!msg.new_chat_members.is_bot){
      let username = msg.new_chat_members[i].username
      let first_name = msg.new_chat_members[i].first_name;
      let last_name = msg.new_chat_members[i].last_name

      let newMember = {
                       id: msg.new_chat_members[i].id,
                       username: username,
                       warnings: 0
                     }
      db.get('users').push(newMember).write()
       if(username)
         bot.sendMessage(msg.chat.id, 'Welcome, @' + username)
       else if(last_name)
         bot.sendMessage(msg.chat.id, 'Welcome,' + first_name+ ''+last_name)
       else
         bot.sendMessage(msg.chat.id, 'Welcome, ' + first_name)
    }
  }

})
bot.on('left_chat_member', (msg)=>{
  db.get('users').remove({id: msg.left_chat_member.id}).write()
  console.log('user deleted');
})
