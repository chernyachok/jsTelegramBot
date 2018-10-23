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
    bannedUsers:[],
    users: []
}).write();



bot.on('message', (msg)=>{
  //console.log(msg);
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if(msg.text){
      if(msg.text.toLowerCase().includes('/ban')) return
      var isAdmin =false;
      bot.getChatAdministrators(msg.chat.id)
        .then((data)=>{
          for(let i =0; i< data.length; i++){
            if(data[i].user.id == msg.from.id){
                isAdmin =true;
            }
          }
          if(!isAdmin &&typeof filter.isProfane(msg.text) == 'string'){
            var options ={ parse_mode: 'HTML'}
            bot.deleteMessage(msg.chat.id, msg.message_id)
              .then(()=>{
                var warns = db.get('users').find({id: msg.from.id}).value().warnings
                let currentWarnings = db.get('users').find({id: msg.from.id}).assign({warnings: ++warns}).write().warnings
                //console.log(currentWarnings);
                if(currentWarnings ==3){
                  let username = msg.from.username? ('(@'+msg.from.username+')') : ''
                  bot.kickChatMember(msg.chat.id, msg.from.id)
                  db.get('bannedUsers').push({id: msg.from.id,username:username}).write()
                  return bot.sendMessage(msg.chat.id, "User "+msg.from.first_name+' '+username+"\n<b>banned </b>:reached the max\nnumber of warnings(3/3)",options)
                }
                let status = `\nYou have ${currentWarnings}`+(currentWarnings==1 ? ' warning' : ' warnings')
                if(msg.from.username)
                  bot.sendMessage(msg.chat.id, 'Profane words are not allowed, @' + msg.from.username+status)
                else if(msg.from.last_name)
                  bot.sendMessage(ctx.chat.id, 'Profane words are not allowed,' + msg.from.first_name+ ''+ msg.from.last_name+status)
                else
                  bot.sendMessage(msg.chat.id, 'Profane words are not allowed, ' + msg.from.first_name+status)

              })

          }
        })
    }
  }
})


bot.on('new_chat_members', (msg)=>{
  //console.log(msg);
  let options = [[{
    text: 'Get started',
    url: config.bot_url
  }]]
  let keyboard = {parse_mode:'Markdown', reply_markup: { inline_keyboard: options }}
  for(let i=0; i<msg.new_chat_members.length; i++){
    if(!msg.new_chat_members[i].is_bot){
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
          bot.sendMessage(msg.chat.id, 'Welcome, @' + username, keyboard)
        else if(last_name)
          bot.sendMessage(msg.chat.id, 'Welcome,' + first_name+ ' '+last_name, keyboard)
        else
          bot.sendMessage(msg.chat.id, 'Welcome, ' + first_name, keyboard)
    }
  }
})
bot.on('left_chat_member', (msg)=>{
  db.get('users').remove({id: msg.left_chat_member.id}).write()
  console.log('user deleted');
})


bot.onText(/\/ban/, (msg)=>{
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    let bannedUsers =db.get('bannedUsers').value()
    var str = ''
    for(let i =0; i<bannedUsers.length;i++){
      str+= ((i+1)+'-'+bannedUsers[i].id+' '+bannedUsers[i].username)+'\n'
    }
    bot.sendMessage(msg.chat.id,"<b>Banned users:</b>\n"+str, {parse_mode:'HTML'})
  }
})

bot.on('message',(msg)=>{
  if(msg.chat.type == 'private')
    bot.sendMessage(msg.chat.id, 'i`m bot.q')
})

bot.on('polling_error', (error)=>{
  console.log(error);
})
