var telegramBot = require('node-telegram-bot-api')
var config = require('./config.json')
var fetch = require('node-fetch')
var Filter = require('bad-words')
const request = require('request');
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
    users: [],
    rules: null
}).write();

let newRulesAwait = {}

bot.on('message', (msg)=>{
  //console.log(msg);
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if(msg.text){
      var received_msg = msg.text.toLowerCase()
      if(received_msg.includes('/ban') || received_msg.includes('/setrules')
      || received_msg.includes('/getrules') ||received_msg.includes('/start') )
        return
      if(newRulesAwait.hasOwnProperty('rules')){
        db.update('rules', oldRules=>msg.text).write()
        delete newRulesAwait['rules']
        bot.sendMessage(msg.chat.id, "Success! Type `/getrules` to see rules of this group", {parse_mode: 'markdown'})
        //console.log(newRulesAwait.hasOwnProperty('rules')+" is rule in stack");
        return
      }
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
                    .then(()=>{
                      db.get('bannedUsers').push({id: msg.from.id,username:username}).write()
                      return bot.sendMessage(msg.chat.id, "User "+msg.from.first_name+' '+username+"\n<b>banned </b>:reached the max\nnumber of warnings(3/3)",options)
                    })
                }
                else{//0,1,2 warnings
                  let status = `\nYou have ${currentWarnings}`+(currentWarnings==1 ? ' warning' : ' warnings')
                  if(msg.from.username)
                    bot.sendMessage(msg.chat.id, 'Profane words are not allowed, @' + msg.from.username+status)
                  else if(msg.from.last_name)
                    bot.sendMessage(ctx.chat.id, 'Profane words are not allowed,' + msg.from.first_name+ ''+ msg.from.last_name+status)
                  else
                    bot.sendMessage(msg.chat.id, 'Profane words are not allowed, ' + msg.from.first_name+status)

                }
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
                       username: username || 'noname',
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

bot.on('polling_error', (error)=>{
  console.log(error);
})

bot.onText(/\/setrules/, (msg)=>{
  //console.log(msg);
  if(msg.chat.type === 'group' || msg.chat.type === 'supergroup'){
    let isAdmin = false
    bot.getChatAdministrators(msg.chat.id)
      .then((data)=>{
        for(let i =0; i< data.length; i++){
          if(data[i].user.id == msg.from.id){
              isAdmin =true;
          }
        }
        if(isAdmin){
          bot.sendMessage(msg.chat.id, "Now set up rules for this group", {parse_mode:'Markdown'})
          newRulesAwait['rules'] = true
          //console.log(newRulesAwait.hasOwnProperty('rules')+" is rule in stack");
        }else{
          bot.sendMessage(msg.chat.id, "Only admin can set up rules")
        }
    })
  }
})

bot.onText(/\/getrules/, (msg)=>{
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup'){
    let getrules = db.get('rules').value()
    bot.sendMessage(msg.chat.id,getrules )
  }

})


bot.onText(/\/start/, (msg) => {
  if(msg.chat.type === 'group' || msg.chat.type === 'supergroup'){
    bot.sendMessage(msg.chat.id, 'This bot allows to filter messages in group chats and channels.\n'//parse mode only parse ``
      +'If the user breaks the profane rule he receives a warning and his \'bad word\' automatically deletes.\n'
      +'If that user warning count equals 3, he is kicked out of this chat.\n'
      + 'To show banned users:\n'
      + '`/ban`\n'
      + 'To set chat rules (for admin only):\n'
      +'`/setrules`\n'
      + 'To get chat rules:\n'
      + '`/getrules`\n'
      , {parse_mode: 'markdown'});
  }
});
/// for private conversation
var userStorage = []
bot.on('message',(msg)=>{
  if(msg.chat.type == 'private'){
    if(msg.text == '/start'){
    return  bot.sendMessage(msg.chat.id, 'This bot allows to filter messages in group chats and channels.\n'//parse mode only parse ``
        +'Add this bot to group chat and make him an administrator.\n'
      //  +'To generate random gif:\n'
      //  +'`/gif`\n'
        +'To generate random photo:\n'
        +'`/photo`\n'

        , {parse_mode: 'markdown'});
    }
    if(msg.text == '/photo'){
      var rand = Math.floor(Math.random()*9)
        rand ==0?  rand=1 : false
        //console.log(rand);
      let randomImage = 'playboy/'+rand+'.jpg'
      for(let i= 0; i<userStorage.length; i++){
         if(userStorage[i].user_id==msg.from.id && userStorage[i].randed == rand){
          return bot.forwardMessage(msg.chat.id, msg.chat.id, userStorage[i].msg_id)
         }
      }
      if(userStorage.length >500){
        userStorage.splice(0, 100)
      }
        bot.sendPhoto(msg.chat.id, randomImage)
          .then((photo)=>{
            //console.log(photo);
            userStorage.push({user_id: msg.from.id, randed: rand,photo: photo.photo[2].file_id, msg_id: photo.message_id})
            //console.log(userStorage);
          })
          .catch((err)=>bot.sendMessage(msg.chat.id, 'Error 404. Please try again'))
    }
  }
})
