require 'sinatra'
require 'redis'
require 'haml'
require 'json'
require 'date'

use Rack::Session::Cookie,
  :key => 'session',
  :path => '/',
  :expire_after => 31536000,
  :secret => 'thisisanawesomesecretomgitssogood!!!11onelol'

redis = Redis.new


get '/' do
  haml :index
end

get '/:game_id' do
  game_state = redis.get(params[:game_id])
  session[:id] ||= Random.new.rand(1000000..9999999)
  if not game_state
    redis.set(params[:game_id], {
      :started => false,
      :created_at => DateTime.now.to_s
    }.to_json)
    game_state = redis.get(params[:game_id])
  else
    game_state = JSON.parse(game_state)
  end
  haml :chessgame, :locals => { :fen => game_state["fen"] }
end

get '/:game_id/wait' do
  content_type :json
  game_state = JSON.parse(redis.get(params[:game_id]))
  game_state["fen"].to_json
end

post '/:game_id/color' do
  session[:color] = params[:color]
  content_type :json
  {:color => session[:color]}.to_json
end

post '/:game_id/move' do
  game_state = JSON.parse(redis.get(params[:game_id]))
  game_state["fen"] = params[:fen]
  redis.set(params[:game_id], game_state.to_json)
  content_type :json
  1.to_json
end


